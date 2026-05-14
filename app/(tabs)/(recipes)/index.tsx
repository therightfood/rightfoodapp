import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Camera,
  Image as ImageIcon,
  UtensilsCrossed,
  AlertCircle,
  ChevronDown,
  Clock,
  Zap,
  Flame,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { authClient } from '@/lib/auth';

interface Recipe {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  estimated_calories_per_serving: number;
  protein_g_per_serving: number;
  prep_time_minutes: number;
}

// ─── RecipeCard ───────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onScanMeal: () => void;
}

function RecipeCard({ recipe, expanded, onToggle, onScanMeal }: RecipeCardProps) {
  const calories = recipe.estimated_calories_per_serving;
  const protein = recipe.protein_g_per_serving;
  const prepTime = recipe.prep_time_minutes;

  const caloriesText = String(calories) + ' kcal';
  const proteinText = String(protein) + 'g protein';
  const prepText = String(prepTime) + ' min';

  const chevronRotation = expanded ? '180deg' : '0deg';

  return (
    <View style={cardStyles.card}>
      {/* Header */}
      <View style={cardStyles.header}>
        <Text style={cardStyles.name}>{recipe.name}</Text>
        <Text style={cardStyles.description}>{recipe.description}</Text>

        <View style={cardStyles.statsRow}>
          <View style={cardStyles.stat}>
            <Flame size={14} color={COLORS.accent} />
            <Text style={cardStyles.statText}>{caloriesText}</Text>
          </View>
          <View style={cardStyles.stat}>
            <Zap size={14} color={COLORS.primary} />
            <Text style={cardStyles.statText}>{proteinText}</Text>
          </View>
          <View style={cardStyles.stat}>
            <Clock size={14} color={COLORS.textSecondary} />
            <Text style={cardStyles.statText}>{prepText}</Text>
          </View>
        </View>
      </View>

      {/* Toggle row */}
      <AnimatedPressable onPress={onToggle} style={cardStyles.toggleRow}>
        <Text style={cardStyles.toggleText}>
          {expanded ? 'Hide details' : 'Show ingredients & steps'}
        </Text>
        <ChevronDown
          size={16}
          color={COLORS.primary}
          style={{ transform: [{ rotate: chevronRotation }] }}
        />
      </AnimatedPressable>

      {/* Expanded section */}
      {expanded && (
        <View style={cardStyles.expandedSection}>
          <Text style={cardStyles.sectionLabel}>INGREDIENTS</Text>
          {recipe.ingredients.map((ingredient, i) => (
            <View key={i} style={cardStyles.ingredientRow}>
              <View style={cardStyles.dot} />
              <Text style={cardStyles.ingredientText}>{ingredient}</Text>
            </View>
          ))}

          <Text style={[cardStyles.sectionLabel, { marginTop: 16 }]}>INSTRUCTIONS</Text>
          {recipe.instructions.map((step, i) => {
            const stepNum = String(i + 1);
            return (
              <View key={i} style={cardStyles.stepRow}>
                <Text style={cardStyles.stepNumber}>{stepNum}</Text>
                <Text style={cardStyles.stepText}>{step}</Text>
              </View>
            );
          })}

          <AnimatedPressable onPress={onScanMeal} style={cardStyles.scanMealButton}>
            <Camera size={14} color={COLORS.primary} />
            <Text style={cardStyles.scanMealText}>Scan this meal</Text>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    padding: 16,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  toggleRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  expandedSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.surfaceSecondary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  ingredientText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    width: 20,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    flex: 1,
  },
  scanMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    marginTop: 16,
  },
  scanMealText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

// ─── RecipesScreen ────────────────────────────────────────────────────────────

export default function RecipesScreen() {
  const router = useRouter();

  const [ingredientsText, setIngredientsText] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractingIngredients, setExtractingIngredients] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const extractIngredients = async (uri: string) => {
    console.log('[Recipes] extractIngredients called with uri:', uri);
    setExtractingIngredients(true);
    setError(null);
    try {
      const session = await authClient.getSession();
      const token = session?.data?.session?.token;

      const formData = new FormData();
      formData.append('image', { uri, type: 'image/jpeg', name: 'fridge.jpg' } as any);

      console.log('[Recipes] POST /api/recipes/extract-ingredients');
      const res = await fetch(
        'https://3pqctptn272ematfhedrjv4we23tdyxd.app.specular.dev/api/recipes/extract-ingredients',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.warn('[Recipes] extract-ingredients error:', res.status, errText);
        throw new Error('Could not identify ingredients');
      }
      const data = await res.json();
      console.log('[Recipes] extract-ingredients response:', data);
      const joined = (data.ingredients as string[]).join(', ');
      setIngredientsText(joined);
    } catch (err: any) {
      console.error('[Recipes] extractIngredients error:', err);
      setError('Could not identify ingredients from photo. Please type them manually.');
    } finally {
      setExtractingIngredients(false);
    }
  };

  const generateRecipes = async () => {
    if (!ingredientsText.trim()) return;
    console.log('[Recipes] generateRecipes called with ingredients:', ingredientsText.trim());
    setLoading(true);
    setError(null);
    setRecipes([]);
    setExpandedIndex(null);

    try {
      const session = await authClient.getSession();
      const token = session?.data?.session?.token;

      console.log('[Recipes] POST /api/recipes/generate');
      const res = await fetch(
        'https://3pqctptn272ematfhedrjv4we23tdyxd.app.specular.dev/api/recipes/generate',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ingredients: ingredientsText.trim() }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.warn('[Recipes] generate error:', res.status, errData);
        throw new Error((errData as any).error || 'Could not generate recipes');
      }

      const data = await res.json();
      console.log('[Recipes] generate response: received', (data.recipes || []).length, 'recipes');
      setRecipes(data.recipes || []);
    } catch (err: any) {
      console.error('[Recipes] generateRecipes error:', err);
      setError(err.message || 'Could not generate recipes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanFridge = async () => {
    console.log('[Recipes] Scan fridge button pressed');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[Recipes] Camera permission denied');
      setError('Camera permission is required to scan your fridge.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      console.log('[Recipes] Camera image captured:', result.assets[0].uri);
      extractIngredients(result.assets[0].uri);
    }
  };

  const handleFromLibrary = async () => {
    console.log('[Recipes] From library button pressed');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[Recipes] Media library permission denied');
      setError('Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      console.log('[Recipes] Library image selected:', result.assets[0].uri);
      extractIngredients(result.assets[0].uri);
    }
  };

  const handleScanMeal = (dishName: string) => {
    console.log('[Recipes] Scan this meal pressed for:', dishName);
    router.push('/(tabs)/(scan)');
  };

  const handleToggleRecipe = (index: number) => {
    console.log('[Recipes] Toggle recipe card index:', index);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const isGetRecipesDisabled = ingredientsText.trim() === '' || loading;
  const getRecipesOpacity = isGetRecipesDisabled ? 0.4 : 1;
  const inputBorderColor = inputFocused ? COLORS.primary : COLORS.border;

  const showEmptyState = recipes.length === 0 && !loading && !error;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Recipes</Text>
          <Text style={styles.headerSubtitle}>GLP-1 friendly recipes for your ingredients</Text>
        </View>

        {/* Input card */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Your ingredients</Text>
          <TextInput
            style={[styles.textInput, { borderColor: inputBorderColor, borderWidth: 1 }]}
            multiline
            placeholder="e.g. chicken breast, broccoli, olive oil, garlic..."
            placeholderTextColor={COLORS.textTertiary}
            value={ingredientsText}
            onChangeText={setIngredientsText}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />

          {/* Photo buttons */}
          <View style={styles.photoButtonRow}>
            <AnimatedPressable onPress={handleScanFridge} style={styles.photoButton}>
              <Camera size={16} color={COLORS.textSecondary} />
              <Text style={styles.photoButtonText}>Scan fridge</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={handleFromLibrary} style={styles.photoButton}>
              <ImageIcon size={16} color={COLORS.textSecondary} />
              <Text style={styles.photoButtonText}>From library</Text>
            </AnimatedPressable>
          </View>

          {/* Extracting indicator */}
          {extractingIngredients && (
            <View style={styles.extractingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.extractingText}>Identifying ingredients...</Text>
            </View>
          )}

          {/* Get recipes button */}
          <AnimatedPressable
            onPress={generateRecipes}
            disabled={isGetRecipesDisabled}
            style={[styles.getRecipesButton, { opacity: getRecipesOpacity }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.getRecipesText}>Get recipes</Text>
            )}
          </AnimatedPressable>
        </View>

        {/* Error state */}
        {error !== null && (
          <View style={styles.errorContainer}>
            <AlertCircle size={20} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Loading state */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Finding recipes for your ingredients...</Text>
          </View>
        )}

        {/* Empty state */}
        {showEmptyState && (
          <View style={styles.emptyState}>
            <UtensilsCrossed size={32} color={COLORS.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyText}>
              Enter your ingredients above to get personalized recipe ideas.
            </Text>
          </View>
        )}

        {/* Recipe cards */}
        {recipes.length > 0 && (
          <View style={styles.recipesContainer}>
            {recipes.map((recipe, index) => (
              <RecipeCard
                key={index}
                recipe={recipe}
                index={index}
                expanded={expandedIndex === index}
                onToggle={() => handleToggleRecipe(index)}
                onScanMeal={() => handleScanMeal(recipe.name)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  inputCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  textInput: {
    minHeight: 80,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  photoButton: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  extractingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  extractingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  getRecipesButton: {
    marginTop: 16,
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getRecipesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.dangerMuted,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.danger,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  recipesContainer: {
    marginHorizontal: 16,
    marginTop: 12,
  },
});
