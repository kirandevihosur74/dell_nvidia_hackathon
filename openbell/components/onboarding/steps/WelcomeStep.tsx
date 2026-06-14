import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Text, Image, Animated, Dimensions, Platform, ScrollView } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { ArrowRight, TrendingUp, ChartBar, LineChart, BarChart, PieChart } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
// Onboarding ticker uses static sample data — no live market store dependency.

interface WelcomeStepProps {
  onNext: () => void;
}

// Define symbol priorities for ticker display
const TICKER_SYMBOLS = [
  { symbol: "AAPL", name: "Apple Inc.", type: "stock" },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "stock" },
  { symbol: "TSLA", name: "Tesla Inc", type: "stock" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "stock" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", type: "stock" },
  { symbol: "BTC-USD", name: "Bitcoin USD", type: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum USD", type: "crypto" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", type: "etf" },
];

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const [activeIcon, setActiveIcon] = useState(0);
  const tickerAnim = useRef(new Animated.Value(0)).current;
  const [tickerWidth, setTickerWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Static ticker data only (live market fetch removed for onboarding).
  const assets: Record<string, { symbol: string; price: number; change: number }> = {};
  const useDefaultTickerData = true;

  // Ref to track the mounted state
  const isMounted = useRef(true);
  
  const DEFAULT_TICKER_DATA = [
    { symbol: "AAPL", price: "192.32", change: "+1.23", direction: "up" },
    { symbol: "MSFT", price: "334.21", change: "-0.56", direction: "down" },
    { symbol: "TSLA", price: "812.45", change: "+0.78", direction: "up" },
    { symbol: "GOOGL", price: "2789.24", change: "+0.12", direction: "up" },
    { symbol: "AMZN", price: "3456.78", change: "-0.34", direction: "down" },
  ];
  
  const icons = [
    <TrendingUp size={60} color={Colors.primary} />,
    <LineChart size={60} color={Colors.primary} />,
    <BarChart size={60} color={Colors.primary} />,
    <PieChart size={60} color={Colors.primary} />
  ];

  // Format data from the market store for the ticker
  const formatTickerData = () => {
    if (useDefaultTickerData || Object.keys(assets).length === 0) {
      return DEFAULT_TICKER_DATA;
    }
    
    return TICKER_SYMBOLS
      .filter(symbol => assets[symbol.symbol]) // Only include symbols we have data for
      .map(symbol => {
        const asset = assets[symbol.symbol];
        return {
          symbol: asset.symbol,
          price: asset.price.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          }),
          change: `${asset.change >= 0 ? '+' : ''}${asset.change.toFixed(2)}%`,
          direction: asset.change >= 0 ? 'up' : 'down'
        };
      });
  };

  // Get the ticker data (memoized to prevent unnecessary re-renders)
  const tickerData = React.useMemo(() => formatTickerData(), [assets, useDefaultTickerData]);

  // Animation setup effect - runs only once
  useEffect(() => {
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }),
    ]).start();

    // Rotate icon animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconRotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(iconRotateAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        })
      ])
    ).start();

    // Cycle through different icons
    const iconInterval = setInterval(() => {
      setActiveIcon((prev) => (prev + 1) % icons.length);
    }, 3000);
    
    // Cleanup function
    return () => { 
      clearInterval(iconInterval);
      isMounted.current = false;
    };
  }, []);

  // Ticker animation setup - only when dimensions change
  useEffect(() => {
    // Only start the animation when we have both measurements and haven't started yet
    if (tickerWidth && containerWidth) {
      tickerAnim.setValue(containerWidth);
      
      // Calculate the full distance needed
      const animationDistance = containerWidth + tickerWidth + 100;
      const speed = 100; // pixels per second (increased from 30 for faster scrolling)
      const duration = (animationDistance / speed) * 1000;
      
      // Start the animation loop just once
      Animated.loop(
        Animated.timing(tickerAnim, {
          toValue: -tickerWidth,
          duration: Math.max(6000, duration), // Reduced minimum duration for faster scrolling
          useNativeDriver: true,
          easing: t => t,
        })
      ).start();
    }
    
    return () => {
      // Stop any running animations when dependencies change
      tickerAnim.stopAnimation();
    };
  }, [tickerWidth, containerWidth]); // Only depend on the dimensions, not the data

  const rotation = iconRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const windowHeight = Dimensions.get('window').height;
  
  return (
    <View style={[styles.container, { minHeight: Dimensions.get('window').height }]} key="welcome-step">
      {/* Marquee Ticker at the very top */}
      <View style={styles.tickerContainer} onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            transform: [{ translateX: tickerAnim }],
          }}
          onLayout={e => setTickerWidth(e.nativeEvent.layout.width)}
        >
          {/* Render ticker items twice to create a continuous loop effect */}
          {[...tickerData, ...tickerData].map((s, idx) => (
            <React.Fragment key={`${s.symbol}-${idx}`}>
              <View style={styles.tickerItem}>
                <Text style={styles.tickerSymbol}>{s.symbol}</Text>
                <Text style={styles.tickerPrice}>{s.price}</Text>
                <Text style={s.direction === 'up' ? styles.tickerChangeUp : styles.tickerChangeDown}>
                  {s.direction === 'up' ? '▲' : '▼'}{s.change}
                </Text>
              </View>
              <View style={styles.tickerSeparator} />
            </React.Fragment>
          ))}
        </Animated.View>
      </View>
      
      <LinearGradient
        colors={[Colors.primary + "05", Colors.background, Colors.background]}
        style={styles.backgroundGradient}
      />
      {/* Floating elements in the background */}
      <View style={styles.floatingElementsContainer}>
        <Animated.View style={[styles.floatingElement, styles.element1, { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, -1) }] }]}>
          <ChartBar size={24} color={Colors.primary + "50"} />
        </Animated.View>
        <Animated.View style={[styles.floatingElement, styles.element2, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LineChart size={32} color={Colors.primary + "40"} />
        </Animated.View>
        <Animated.View style={[styles.floatingElement, styles.element3, { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, 0.5) }] }]}>
          <TrendingUp size={28} color={Colors.primary + "60"} />
        </Animated.View>
      </View>

      <Animated.View 
        style={[
          styles.imageContainer, 
          { 
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ],
          }
        ]}
      >
        <LinearGradient
          colors={[Colors.primaryLight, Colors.primary + "50"]}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.iconContainer}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            {icons[activeIcon]}
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.View 
        style={[
          styles.textContainer,
          { 
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim }
            ] 
          }
        ]}
      >
        <Text style={[Typography.h1, styles.title]}>Welcome to OpenBell</Text>
        <Text style={[Typography.body1, styles.subtitle]}>Your AI-Powered Financial Intelligence Platform</Text>
        <Text style={styles.description}>
          Build financial knowledge, learn investment strategies, 
          and access personalized guidance on your OpenBell journey.
        </Text>
       
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Smart portfolio analysis</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Real-time market insights</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>AI-powered investment recommendations</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Educational content & community</Text>
          </View>
        </View>
      </Animated.View>
      <Animated.View 
        style={[
          styles.buttonContainer,
          { 
            opacity: fadeAnim
          }
        ]}
      >
        <Button 
          title="Get Started" 
          variant="primary"
          icon={<ArrowRight size={20} color={Colors.white} />}
          iconPosition="right"
          size="large"
          onPress={onNext}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    position: "relative",
    backgroundColor: Colors.background,
    width: '100%',
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
  },
  floatingElementsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  floatingElement: {
    position: 'absolute',
    padding: 12,
    borderRadius: 50,
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  element1: {
    top: '10%',
    right: '15%',
  },
  element2: {
    top: '30%',
    left: '10%',
  },
  element3: {
    bottom: '25%',
    right: '20%',
  },
  imageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: Spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: Spacing.lg,
    width: '100%',
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
    color: Colors.text,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
  },
  subtitle: {
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  aiGuideText: {
    ...Typography.body2,
    color: Colors.primary,
    marginVertical: Spacing.md,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  featuresContainer: {
    alignItems: "flex-start",
    width: '100%',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: Spacing.sm,
  },
  featureText: {
    ...Typography.body2,
    color: Colors.text,
  },
  buttonContainer: {
    width: '100%',
    marginTop: Spacing.md,
    zIndex: 10,
  },
  tickerContainer: {
    width: '100%',
    height: 40,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    paddingHorizontal: 0,
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    height: 40,
    marginRight: 0,
  },
  tickerSymbol: {
    color: '#FFD700', // gold/yellow
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  tickerPrice: {
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    marginLeft: 2,
  },
  tickerChangeUp: {
    color: '#4ADE80', // softer green
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    marginLeft: 2,
  },
  tickerChangeDown: {
    color: '#F87171', // softer red
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    marginLeft: 2,
  },
  tickerSeparator: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 4,
  },
});

export default WelcomeStep;