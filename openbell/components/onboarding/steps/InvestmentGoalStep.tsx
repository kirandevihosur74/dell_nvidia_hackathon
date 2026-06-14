import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { ArrowRight, Brain, ShieldCheck, TrendingUp, Landmark, Home, Heart, Briefcase, GraduationCap } from "lucide-react-native";
import SkipButton from "../SkipButton";

interface InvestmentGoalStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
}

interface GoalOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const InvestmentGoalStep: React.FC<InvestmentGoalStepProps> = ({ onNext, onBack, onSkip }) => {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const goals: GoalOption[] = [
    {
      id: "retirement",
      title: "Retirement",
      description: "Save for a comfortable retirement",
      icon: <ShieldCheck size={24} color={selectedGoal === "retirement" ? "#fff" : Colors.primary} />,
    },
    {
      id: "wealth",
      title: "Wealth Building",
      description: "Grow your overall net worth",
      icon: <TrendingUp size={24} color={selectedGoal === "wealth" ? "#fff" : Colors.primary} />,
    },
    {
      id: "financial_freedom",
      title: "Financial Freedom",
      description: "Work becomes optional, not necessary",
      icon: <Landmark size={24} color={selectedGoal === "financial_freedom" ? "#fff" : Colors.primary} />,
    },
    {
      id: "home",
      title: "Home Purchase",
      description: "Save for a home down payment",
      icon: <Home size={24} color={selectedGoal === "home" ? "#fff" : Colors.primary} />,
    },
    {
      id: "health",
      title: "Health & Family",
      description: "Secure your family's financial health",
      icon: <Heart size={24} color={selectedGoal === "health" ? "#fff" : Colors.primary} />,
    },
    {
      id: "business",
      title: "Business Investment",
      description: "Fund a business venture",
      icon: <Briefcase size={24} color={selectedGoal === "business" ? "#fff" : Colors.primary} />,
    },
    {
      id: "education",
      title: "Education",
      description: "Save for education expenses",
      icon: <GraduationCap size={24} color={selectedGoal === "education" ? "#fff" : Colors.primary} />,
    },
  ];

  const handleNext = () => {
    onNext();
  };

  const renderGoalCard = (goal: GoalOption) => {
    const isSelected = selectedGoal === goal.id;
    
    return (
      <TouchableOpacity
        key={goal.id}
        style={[
          styles.goalCard,
          isSelected ? styles.selectedGoalCard : {},
        ]}
        onPress={() => setSelectedGoal(goal.id)}
      >
        <View style={[styles.iconContainer, isSelected ? styles.selectedIconContainer : {}]}>
          {goal.icon}
        </View>
        <View style={styles.goalTextContainer}>
          <Text style={[styles.goalTitle, isSelected ? styles.selectedText : {}]}>
            {goal.title}
          </Text>
          <Text style={styles.goalDescription}>
            {goal.description}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.aiTipContainer}>
        <Brain size={16} color={Colors.primary} style={styles.brainIcon} />
        <Text style={styles.aiTipText}> Not sure which goal to choose? Ask the AI Assistant for personalized guidance.</Text>
      </Text>
      
      <View style={styles.goalsContainer}>
        {goals.map(renderGoalCard)}
      </View>
      
      <View style={styles.buttonsContainer}>
        <Button
          title="Back"
          variant="outline"
          onPress={onBack}
          style={styles.backButton}
        />
        
        <Button
          title="Continue"
          onPress={handleNext}
          disabled={!selectedGoal}
          style={styles.continueButton}
          icon={<ArrowRight size={20} color="#fff" />}
          iconPosition="right"
        />
      </View>
      
      {onSkip && <SkipButton onSkip={onSkip} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  aiTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  brainIcon: {
    marginRight: 6,
  },
  aiTipText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  goalsContainer: {
    flex: 1,
  },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedGoalCard: {
    borderColor: Colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F7F9',
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  selectedIconContainer: {
    backgroundColor: Colors.primary,
  },
  goalTextContainer: {
    flex: 1,
  },
  goalTitle: {
    ...Typography.subtitle1,
    color: Colors.text,
    marginBottom: 2,
  },
  goalDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  selectedText: {
    color: Colors.primary,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  continueButton: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  backButton: {
    flex: 1,
    marginRight: Spacing.sm,
  },
});

export default InvestmentGoalStep;