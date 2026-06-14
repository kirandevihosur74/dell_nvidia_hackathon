module.exports = {
  preset: "jest-expo/ios",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFiles: ["<rootDir>/__tests__/setup.ts"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native|zustand|@react-native-async-storage/async-storage)",
  ],
  // Resolve the Expo runtime's structuredClone/import.meta issue
  globals: {
    __DEV__: true,
  },
  resolver: undefined,
};
