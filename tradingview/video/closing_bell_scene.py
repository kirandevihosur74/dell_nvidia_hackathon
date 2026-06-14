"""
Closing Bell — Manim Community scene (data-driven, no LaTeX).

Renders an "After the Bell" explainer video from a plain JSON data file so it
is fully decoupled from Flask / yfinance: set MANIM_DATA to the JSON path.
Optional MANIM_AUDIO embeds a narration track; MANIM_TARGET_DURATION pads the
final frame so the video isn't shorter than the voiceover.

Render:
    manim -qm closing_bell_scene.py ClosingBellVideo
The orchestrator (make_video.py) sets the env vars and runs this for you.
"""
import json
import os

from manim import (
    Scene, Text, Rectangle, Line, VGroup, Dot,
    FadeIn, FadeOut, GrowFromEdge, Write, Create, LaggedStart,
    config, UP, DOWN, LEFT, RIGHT, ORIGIN,
)

# ---- brand palette (matches the email report) -----------------------------
PAPER = "#ECE9E3"
INK = "#1A1A1A"
SUBTLE = "#6B6B6B"
MAROON = "#9B1C1C"
GREEN = "#16A34A"
RED = "#DC2626"
RULE = "#1A1A1A"

config.background_color = PAPER
SERIF = "Georgia"  # falls back gracefully if unavailable


def _load_data():
    path = os.environ.get("MANIM_DATA")
    if path and os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    # minimal fallback so the scene always renders
    return {
        "title": "THE CLOSING BELL", "date": "Today", "headline": "After the Bell",
        "indices": [{"name": "S&P 500", "value": "6,945", "change_pct": 0.62},
                    {"name": "Nasdaq", "value": "22,150", "change_pct": 0.91},
                    {"name": "Dow", "value": "44,210", "change_pct": 0.28},
                    {"name": "Russell 2000", "value": "2,310", "change_pct": -0.41}],
        "sectors": [{"name": "Technology", "change_pct": 1.21}, {"name": "Energy", "change_pct": -1.62}],
        "gainers": [{"symbol": "NVDA", "change_pct": 3.81}], "losers": [{"symbol": "CVX", "change_pct": -2.63}],
        "tone": "Risk tone: constructive.", "breadth": {"adv": 18, "decl": 12},
    }


def _pct(v):
    return f"{v:+.2f}%"


def _t(s, size, color=INK, weight="NORMAL"):
    return Text(s, font=SERIF, font_size=size, color=color, weight=weight)


class ClosingBellVideo(Scene):
    def construct(self):
        self.data = _load_data()
        audio = os.environ.get("MANIM_AUDIO")
        if audio and os.path.exists(audio):
            self.add_sound(audio)

        self.title_card()
        self.index_scoreboard()
        self.sector_bars()
        self.movers()
        self.radar()
        self.outro()

        # pad to match the narration length if provided
        try:
            target = float(os.environ.get("MANIM_TARGET_DURATION", "0"))
        except ValueError:
            target = 0
        if target and self.renderer.time < target:
            self.wait(target - self.renderer.time)

    # ----------------------------------------------------------------- title
    def title_card(self):
        bar = Rectangle(width=0.12, height=0.9, fill_color=MAROON, fill_opacity=1, stroke_width=0)
        title = _t(self.data.get("title", "THE CLOSING BELL"), 54, INK, "BOLD")
        head = VGroup(bar, title).arrange(RIGHT, buff=0.35)
        sub = _t(self.data.get("headline", "After the Bell"), 30, SUBTLE)
        date = _t(self.data.get("stamp", self.data.get("date", "")), 24, MAROON)
        rule = Line(LEFT * 5, RIGHT * 5, color=RULE, stroke_width=2)
        group = VGroup(head, rule, sub, date).arrange(DOWN, buff=0.4)

        self.play(FadeIn(head, shift=DOWN * 0.3), run_time=1.0)
        self.play(Create(rule), run_time=0.6)
        self.play(Write(sub), FadeIn(date), run_time=0.9)
        self.wait(2.2)
        self.play(FadeOut(group), run_time=0.6)

    # ------------------------------------------------------------ scoreboard
    def index_scoreboard(self):
        heading = self._section(self.data.get("scoreboard_title", "Index Scoreboard")).to_edge(UP, buff=0.7)
        self.play(FadeIn(heading, shift=DOWN * 0.2), run_time=0.6)

        cards = VGroup()
        for idx in self.data.get("indices", [])[:4]:
            up = idx.get("change_pct", 0) >= 0
            col = GREEN if up else RED
            box = Rectangle(width=3.0, height=2.0, stroke_color="#CFC8BA", stroke_width=1.5,
                            fill_color="#FFFFFF", fill_opacity=0.55)
            name = _t(idx.get("name", ""), 22, SUBTLE)
            val = _t(str(idx.get("value", "")), 38, INK, "BOLD")
            chg = _t(_pct(idx.get("change_pct", 0)), 26, col, "BOLD")
            content = VGroup(name, val, chg).arrange(DOWN, buff=0.18)
            cards.add(VGroup(box, content))
        cards.arrange(RIGHT, buff=0.4).scale(0.92).next_to(heading, DOWN, buff=0.8)

        self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.3) for c in cards], lag_ratio=0.25), run_time=1.8)
        self.wait(2.6)
        self.play(FadeOut(heading), FadeOut(cards), run_time=0.6)

    # --------------------------------------------------------------- sectors
    def sector_bars(self):
        heading = self._section(self.data.get("bars_title", "Sector Performance")).to_edge(UP, buff=0.7)
        self.play(FadeIn(heading, shift=DOWN * 0.2), run_time=0.6)

        sectors = sorted(self.data.get("sectors", []), key=lambda s: s.get("change_pct", 0), reverse=True)[:11]
        if not sectors:
            self.play(FadeOut(heading)); return
        scale = max([abs(s.get("change_pct", 0)) for s in sectors] + [0.1])
        max_w = 3.6  # half-width in scene units

        axis_x = 0.3
        top = heading.get_bottom()[1] - 0.6
        row_h = min(0.52, (top - (-3.4)) / len(sectors))
        axis = Line([axis_x, top, 0], [axis_x, top - row_h * len(sectors), 0], color="#CFC8BA", stroke_width=1.5)

        rows, bars = VGroup(), []
        for i, s in enumerate(sectors):
            y = top - row_h * (i + 0.5)
            pct = s.get("change_pct", 0)
            up = pct >= 0
            w = max(0.05, abs(pct) / scale * max_w)
            label = _t(s.get("name", ""), 18, INK).scale(0.8)
            label.move_to([axis_x - max_w - 0.25, y, 0], aligned_edge=RIGHT)
            val = _t(_pct(pct), 18, GREEN if up else RED, "BOLD").scale(0.8)
            val.move_to([axis_x + max_w + 0.25, y, 0], aligned_edge=LEFT)
            if up:
                bar = Rectangle(width=w, height=row_h * 0.62, fill_color=GREEN, fill_opacity=1, stroke_width=0)
                bar.move_to([axis_x + w / 2, y, 0]); edge = LEFT
            else:
                bar = Rectangle(width=w, height=row_h * 0.62, fill_color=RED, fill_opacity=1, stroke_width=0)
                bar.move_to([axis_x - w / 2, y, 0]); edge = RIGHT
            rows.add(label, val)
            bars.append((bar, edge))

        self.play(Create(axis), FadeIn(rows), run_time=0.8)
        self.play(LaggedStart(*[GrowFromEdge(b, e) for b, e in bars], lag_ratio=0.12), run_time=2.4)
        self.wait(2.4)
        self.play(FadeOut(heading), FadeOut(rows), FadeOut(axis),
                  *[FadeOut(b) for b, _ in bars], run_time=0.6)

    # ---------------------------------------------------------------- movers
    def movers(self):
        heading = self._section(self.data.get("movers_title", "Notable Movers")).to_edge(UP, buff=0.7)
        self.play(FadeIn(heading, shift=DOWN * 0.2), run_time=0.6)

        def col(title_text, items, color):
            head = _t(title_text, 24, color, "BOLD")
            rows = VGroup(head)
            for m in items[:4]:
                sym = _t(m.get("symbol", ""), 24, INK, "BOLD")
                chg = _t(_pct(m.get("change_pct", 0)), 22, color, "BOLD")
                rows.add(VGroup(sym, chg).arrange(RIGHT, buff=0.6))
            return rows.arrange(DOWN, buff=0.28, aligned_edge=LEFT)

        gain = col(self.data.get("gainers_title", "TOP GAINERS"), self.data.get("gainers", []), GREEN)
        lose = col(self.data.get("losers_title", "TOP LAGGARDS"), self.data.get("losers", []), RED)
        cols = VGroup(gain, lose).arrange(RIGHT, buff=2.2).next_to(heading, DOWN, buff=0.9)

        self.play(LaggedStart(FadeIn(gain, shift=RIGHT * 0.3), FadeIn(lose, shift=LEFT * 0.3),
                              lag_ratio=0.3), run_time=1.6)
        self.wait(2.6)
        self.play(FadeOut(heading), FadeOut(cols), run_time=0.6)

    # ----------------------------------------------------------------- radar
    def radar(self):
        items = self.data.get("radar", [])
        if not items:
            return
        heading = self._section(self.data.get("radar_title", "On the Radar Today")).to_edge(UP, buff=0.7)
        self.play(FadeIn(heading, shift=DOWN * 0.2), run_time=0.6)

        rows = VGroup()
        for r in items[:5]:
            txt = r.get("text", "") if isinstance(r, dict) else str(r)
            tick = _t("▸", 22, MAROON, "BOLD")
            line = _t(txt, 22, INK)
            if line.width > 10:
                line.scale(10 / line.width)
            rows.add(VGroup(tick, line).arrange(RIGHT, buff=0.25))
        rows.arrange(DOWN, buff=0.32, aligned_edge=LEFT).next_to(heading, DOWN, buff=0.7)

        self.play(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.2) for r in rows], lag_ratio=0.25), run_time=1.8)
        self.wait(2.8)
        self.play(FadeOut(heading), FadeOut(rows), run_time=0.6)

    # ----------------------------------------------------------------- outro
    def outro(self):
        tone = self.data.get("tone", "")
        b = self.data.get("breadth", {})
        breadth = f"{b.get('adv', 0)} advancers  ·  {b.get('decl', 0)} decliners" if b else ""
        bar = Rectangle(width=0.12, height=0.7, fill_color=MAROON, fill_opacity=1, stroke_width=0)
        label = _t("MARKET TONE", 26, MAROON, "BOLD")
        head = VGroup(bar, label).arrange(RIGHT, buff=0.3)
        body = _t(tone or "That's the close.", 24, INK)
        if body.width > 11:
            body.scale(11 / body.width)
        bw = _t(breadth, 22, SUBTLE)
        disc = _t("Informational only — not investment advice.", 18, SUBTLE)
        group = VGroup(head, body, bw, disc).arrange(DOWN, buff=0.5)

        self.play(FadeIn(head), run_time=0.6)
        self.play(Write(body), run_time=1.2)
        self.play(FadeIn(bw), run_time=0.5)
        self.wait(2.4)
        self.play(FadeIn(disc), run_time=0.6)
        self.wait(1.6)
        self.play(FadeOut(group), run_time=0.8)

    # ---------------------------------------------------------------- helper
    def _section(self, text):
        label = _t(text, 30, INK, "BOLD")
        rule = Line(LEFT * 5.5, RIGHT * 5.5, color="#D9D9D9", stroke_width=1.5)
        rule.next_to(label, DOWN, buff=0.18)
        return VGroup(label, rule)
