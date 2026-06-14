"""Postgres-backed store for the User/Subscription data the app used to keep in
MongoDB. Kept intentionally small: it returns plain dicts shaped like the old
Mongo documents (``_id``, ``createdAt`` as datetime, etc.) so the existing
endpoint code keeps working with minimal changes.

Connection is lazy and guarded: if ``DATABASE_URL`` isn't set or Postgres is
unreachable, ``enabled()`` reports False and the app still boots — only the
auth/subscription endpoint needs the DB.
"""
import os
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras

# Defaults to a local peer-auth connection over the unix socket as the current
# OS user. Override with DATABASE_URL=postgresql://user:pass@host:5432/dbname
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql:///tradingview")

_schema_ready = False


def _connect():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def enabled():
    """True if we can actually reach Postgres (and the schema is ensured)."""
    try:
        _ensure_schema()
        return True
    except Exception as exc:  # noqa: BLE001 - boot must not depend on the DB
        print(f"[pg_store] Postgres unavailable, DB features disabled: {exc}")
        return False


def _ensure_schema():
    global _schema_ready
    if _schema_ready:
        return
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id          BIGSERIAL PRIMARY KEY,
                email       TEXT UNIQUE NOT NULL,
                name        TEXT,
                image       TEXT,
                plan        TEXT NOT NULL DEFAULT 'free',
                customer_id TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS subscriptions (
                id         BIGSERIAL PRIMARY KEY,
                user_id    TEXT NOT NULL,
                plan       TEXT NOT NULL DEFAULT 'free',
                period     TEXT NOT NULL DEFAULT 'monthly',
                start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
                end_date   TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS asset_analyses (
                id                  BIGSERIAL PRIMARY KEY,
                symbol              TEXT NOT NULL,
                question            TEXT NOT NULL,
                model               TEXT,
                persona             TEXT,
                intents             TEXT[],
                intents_fulfilled   TEXT[],
                intents_unavailable TEXT[],
                answer              TEXT,
                error               TEXT,
                client_ip           TEXT,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_asset_analyses_symbol
                ON asset_analyses (symbol);
            CREATE INDEX IF NOT EXISTS idx_asset_analyses_created_at
                ON asset_analyses (created_at DESC);
            """
        )
    _schema_ready = True


def _user_doc(row):
    return {
        "_id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "image": row["image"],
        "plan": row["plan"],
        "customerId": row["customer_id"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _sub_doc(row):
    return {
        "_id": row["id"],
        "userId": row["user_id"],
        "plan": row["plan"],
        "period": row["period"],
        "startDate": row["start_date"],
        "endDate": row["end_date"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _base64_email(email):
    import base64
    return base64.b64encode(email.encode()).decode()


def upsert_user(email, name, image):
    """Insert the user if new (else refresh name/image); return a user dict."""
    _ensure_schema()
    now = datetime.utcnow()
    with _connect() as conn, conn.cursor(
        cursor_factory=psycopg2.extras.RealDictCursor
    ) as cur:
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if row is None:
            cur.execute(
                """
                INSERT INTO users (email, name, image, plan, customer_id,
                                   created_at, updated_at)
                VALUES (%s, %s, %s, 'free', %s, %s, %s)
                RETURNING *
                """,
                (email, name, image, f"temp_free_{_base64_email(email)}", now, now),
            )
            row = cur.fetchone()
        else:
            cur.execute(
                """
                UPDATE users SET name = %s, image = %s, updated_at = %s
                WHERE id = %s RETURNING *
                """,
                (name, image, now, row["id"]),
            )
            row = cur.fetchone()
        return _user_doc(row)


def ensure_subscription(user_id):
    """Return the user's subscription, creating a default monthly one if absent."""
    _ensure_schema()
    now = datetime.utcnow()
    with _connect() as conn, conn.cursor(
        cursor_factory=psycopg2.extras.RealDictCursor
    ) as cur:
        cur.execute(
            "SELECT * FROM subscriptions WHERE user_id = %s ORDER BY id LIMIT 1",
            (str(user_id),),
        )
        row = cur.fetchone()
        if row is None:
            cur.execute(
                """
                INSERT INTO subscriptions (user_id, plan, period, start_date,
                                           end_date, created_at, updated_at)
                VALUES (%s, 'free', 'monthly', %s, %s, %s, %s)
                RETURNING *
                """,
                (str(user_id), now, now + timedelta(days=30), now, now),
            )
            row = cur.fetchone()
        return _sub_doc(row)


def save_asset_analysis(symbol, question, *, answer=None, error=None,
                        model=None, persona=None, intents=None,
                        intents_fulfilled=None, intents_unavailable=None,
                        client_ip=None):
    """Persist one /api/analyze_assets result (per symbol). Returns the new
    row id, or None if Postgres is unavailable (must never break the request)."""
    try:
        _ensure_schema()
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO asset_analyses
                    (symbol, question, model, persona, intents,
                     intents_fulfilled, intents_unavailable, answer, error, client_ip)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (symbol, question, model, persona,
                 list(intents) if intents else None,
                 list(intents_fulfilled) if intents_fulfilled else None,
                 list(intents_unavailable) if intents_unavailable else None,
                 answer, error, client_ip),
            )
            return cur.fetchone()[0]
    except Exception as exc:  # noqa: BLE001 - persistence must not sink the request
        print(f"[pg_store] save_asset_analysis failed: {exc}")
        return None
