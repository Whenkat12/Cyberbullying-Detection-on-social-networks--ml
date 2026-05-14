import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCategoryBadgeStyle(category: string): {
  bg: string;
  text: string;
  icon: string;
} {
  const styles: Record<string, { bg: string; text: string; icon: string }> = {
    Threatening: {
      bg: "bg-red-100 dark:bg-red-950",
      text: "text-red-800 dark:text-red-200",
      icon: "🔴",
    },
    Hate_Speech: {
      bg: "bg-orange-100 dark:bg-orange-950",
      text: "text-orange-800 dark:text-orange-200",
      icon: "🟠",
    },
    Sexual_Harassment: {
      bg: "bg-pink-100 dark:bg-pink-950",
      text: "text-pink-800 dark:text-pink-200",
      icon: "❌",
    },
    Toxic_Profanity: {
      bg: "bg-yellow-100 dark:bg-yellow-950",
      text: "text-yellow-800 dark:text-yellow-200",
      icon: "⚠️",
    },
    Non_Bullying: {
      bg: "bg-green-100 dark:bg-green-950",
      text: "text-green-800 dark:text-green-200",
      icon: "✅",
    },
  };

  return styles[category] || styles.Non_Bullying;
}
