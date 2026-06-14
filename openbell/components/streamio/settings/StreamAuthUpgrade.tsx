import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useStreamIOAuth } from '@/hooks/streamio/useStreamIOAuth';
import { LogIn, LogOut, User } from 'lucide-react-native';

export function StreamAuthUpgrade() {
  const { theme } = useThemeStore();
  const { auth, isAuthenticated, isGuest, upgradeToKinde, logout } = useStreamIOAuth();

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.border,
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 15, color: theme.text }}>Account</Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}>
            {isGuest
              ? 'Guest mode — sign in for persistent history'
              : auth?.email || 'Authenticated'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: isAuthenticated ? theme.success : theme.textTertiary,
            }}
          />
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>
            {isGuest ? 'Guest' : 'Signed In'}
          </Text>
        </View>
      </View>

      {isGuest && (
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.border,
          }}
          onPress={upgradeToKinde}
        >
          <LogIn size={18} color={theme.primary} />
          <Text style={{ fontSize: 15, color: theme.primary, fontWeight: '500' }}>
            Sign In with Kinde
          </Text>
        </TouchableOpacity>
      )}

      {!isGuest && isAuthenticated && (
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 16,
          }}
          onPress={logout}
        >
          <LogOut size={18} color={theme.error} />
          <Text style={{ fontSize: 15, color: theme.error, fontWeight: '500' }}>
            Sign Out
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
