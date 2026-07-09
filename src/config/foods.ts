// Food vault — the built-in nutrition database behind Health-tab logging.
// Values are per 100 g (per 100 ml for liquids), Indian-kitchen weighted.
// One tap logs `serving` grams; portions scale linearly from the 100 g base.
// Barcode scans that resolve via Open Food Facts log as ad-hoc entries and
// never need to live here.

export interface FoodItem {
  id: string
  name: string
  emoji: string
  /** per 100 g / 100 ml */
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** grams in one default serving */
  serving: number
  servingLabel: string
}

// Daily targets the Food tile scores against (cut-phase defaults).
export const KCAL_TARGET = 2200
export const PROTEIN_TARGET = 130
export const WATER_TARGET_ML = 2500
export const GLASS_ML = 250

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type Meal = (typeof MEALS)[number]

export const MEAL_META: Record<Meal, { label: string; emoji: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🌅' },
  lunch: { label: 'Lunch', emoji: '🌞' },
  dinner: { label: 'Dinner', emoji: '🌙' },
  snack: { label: 'Snacks', emoji: '🍿' },
}

export const FOODS: FoodItem[] = [
  // ── Indian staples ─────────────────────────────────────────────────
  { id: 'roti', name: 'Roti / Chapati', emoji: '🫓', kcal: 264, protein: 8.9, carbs: 51, fat: 3.7, serving: 40, servingLabel: '1 roti' },
  { id: 'paratha-plain', name: 'Paratha (plain)', emoji: '🫓', kcal: 320, protein: 7, carbs: 45, fat: 12, serving: 80, servingLabel: '1 paratha' },
  { id: 'aloo-paratha', name: 'Aloo Paratha', emoji: '🥔', kcal: 290, protein: 6, carbs: 41, fat: 11, serving: 120, servingLabel: '1 paratha' },
  { id: 'rice-cooked', name: 'Rice (cooked)', emoji: '🍚', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, serving: 150, servingLabel: '1 katori' },
  { id: 'brown-rice', name: 'Brown Rice (cooked)', emoji: '🍚', kcal: 111, protein: 2.6, carbs: 23, fat: 0.9, serving: 150, servingLabel: '1 katori' },
  { id: 'jeera-rice', name: 'Jeera Rice', emoji: '🍛', kcal: 165, protein: 3, carbs: 30, fat: 4, serving: 150, servingLabel: '1 katori' },
  { id: 'biryani-chicken', name: 'Chicken Biryani', emoji: '🍗', kcal: 165, protein: 9, carbs: 20, fat: 6, serving: 250, servingLabel: '1 plate' },
  { id: 'dal-tadka', name: 'Dal Tadka', emoji: '🥣', kcal: 116, protein: 6, carbs: 15, fat: 4, serving: 150, servingLabel: '1 katori' },
  { id: 'dal-makhani', name: 'Dal Makhani', emoji: '🥣', kcal: 145, protein: 6, carbs: 14, fat: 8, serving: 150, servingLabel: '1 katori' },
  { id: 'chole', name: 'Chole (chickpea curry)', emoji: '🍲', kcal: 140, protein: 7, carbs: 18, fat: 5, serving: 150, servingLabel: '1 katori' },
  { id: 'rajma', name: 'Rajma', emoji: '🫘', kcal: 120, protein: 7, carbs: 17, fat: 3, serving: 150, servingLabel: '1 katori' },
  { id: 'sambar', name: 'Sambar', emoji: '🥣', kcal: 75, protein: 3.5, carbs: 11, fat: 2, serving: 150, servingLabel: '1 katori' },
  { id: 'idli', name: 'Idli', emoji: '⚪', kcal: 135, protein: 3.5, carbs: 28, fat: 0.6, serving: 60, servingLabel: '1 idli' },
  { id: 'dosa-plain', name: 'Dosa (plain)', emoji: '🥞', kcal: 165, protein: 4, carbs: 28, fat: 4, serving: 100, servingLabel: '1 dosa' },
  { id: 'masala-dosa', name: 'Masala Dosa', emoji: '🥞', kcal: 180, protein: 4, carbs: 28, fat: 6, serving: 180, servingLabel: '1 dosa' },
  { id: 'poha', name: 'Poha', emoji: '🍛', kcal: 130, protein: 2.5, carbs: 25, fat: 2.5, serving: 180, servingLabel: '1 plate' },
  { id: 'upma', name: 'Upma', emoji: '🍛', kcal: 132, protein: 3.5, carbs: 22, fat: 3.5, serving: 180, servingLabel: '1 plate' },
  { id: 'khichdi', name: 'Khichdi', emoji: '🍲', kcal: 120, protein: 4.5, carbs: 20, fat: 2.5, serving: 200, servingLabel: '1 bowl' },
  { id: 'paneer-bhurji', name: 'Paneer Bhurji', emoji: '🧀', kcal: 240, protein: 14, carbs: 6, fat: 18, serving: 100, servingLabel: '1 katori' },
  { id: 'palak-paneer', name: 'Palak Paneer', emoji: '🥬', kcal: 160, protein: 8, carbs: 7, fat: 11, serving: 150, servingLabel: '1 katori' },
  { id: 'paneer-tikka', name: 'Paneer Tikka', emoji: '🧀', kcal: 230, protein: 15, carbs: 7, fat: 16, serving: 120, servingLabel: '6 pieces' },
  { id: 'butter-chicken', name: 'Butter Chicken', emoji: '🍗', kcal: 190, protein: 13, carbs: 6, fat: 13, serving: 180, servingLabel: '1 katori' },
  { id: 'chicken-curry', name: 'Chicken Curry (home)', emoji: '🍗', kcal: 145, protein: 14, carbs: 4, fat: 8, serving: 180, servingLabel: '1 katori' },
  { id: 'egg-curry', name: 'Egg Curry', emoji: '🥚', kcal: 150, protein: 9, carbs: 5, fat: 10, serving: 180, servingLabel: '2 eggs + gravy' },
  { id: 'egg-bhurji', name: 'Egg Bhurji', emoji: '🍳', kcal: 200, protein: 13, carbs: 3, fat: 15, serving: 120, servingLabel: '2-egg portion' },
  { id: 'chana-chaat', name: 'Chana Chaat', emoji: '🥗', kcal: 150, protein: 8, carbs: 22, fat: 3.5, serving: 150, servingLabel: '1 bowl' },
  { id: 'curd', name: 'Curd / Dahi', emoji: '🥛', kcal: 62, protein: 3.5, carbs: 4.7, fat: 3.3, serving: 150, servingLabel: '1 katori' },
  { id: 'raita', name: 'Raita', emoji: '🥒', kcal: 55, protein: 3, carbs: 5, fat: 2.5, serving: 100, servingLabel: '1 katori' },
  { id: 'sabzi-mixed', name: 'Mixed Veg Sabzi', emoji: '🥦', kcal: 90, protein: 3, carbs: 10, fat: 4.5, serving: 150, servingLabel: '1 katori' },
  { id: 'bhindi', name: 'Bhindi Sabzi', emoji: '🫛', kcal: 105, protein: 2.5, carbs: 9, fat: 7, serving: 120, servingLabel: '1 katori' },
  { id: 'aloo-gobi', name: 'Aloo Gobi', emoji: '🥔', kcal: 110, protein: 2.5, carbs: 14, fat: 5, serving: 150, servingLabel: '1 katori' },

  // ── Protein anchors ───────────────────────────────────────────────
  { id: 'egg-whole', name: 'Egg (whole, boiled)', emoji: '🥚', kcal: 155, protein: 13, carbs: 1.1, fat: 11, serving: 50, servingLabel: '1 egg' },
  { id: 'egg-white', name: 'Egg White', emoji: '🥚', kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, serving: 33, servingLabel: '1 white' },
  { id: 'chicken-breast', name: 'Chicken Breast (cooked)', emoji: '🍗', kcal: 165, protein: 31, carbs: 0, fat: 3.6, serving: 100, servingLabel: '100 g' },
  { id: 'chicken-thigh', name: 'Chicken Thigh (cooked)', emoji: '🍗', kcal: 209, protein: 26, carbs: 0, fat: 11, serving: 100, servingLabel: '100 g' },
  { id: 'fish-rohu', name: 'Fish (rohu, cooked)', emoji: '🐟', kcal: 120, protein: 20, carbs: 0, fat: 4, serving: 100, servingLabel: '1 piece' },
  { id: 'tuna-can', name: 'Tuna (canned in water)', emoji: '🐟', kcal: 116, protein: 26, carbs: 0, fat: 1, serving: 100, servingLabel: '1 can' },
  { id: 'mutton', name: 'Mutton (cooked)', emoji: '🥩', kcal: 250, protein: 26, carbs: 0, fat: 16, serving: 100, servingLabel: '100 g' },
  { id: 'paneer', name: 'Paneer (raw)', emoji: '🧀', kcal: 265, protein: 18, carbs: 3.5, fat: 20, serving: 60, servingLabel: '60 g cube' },
  { id: 'tofu', name: 'Tofu', emoji: '🧊', kcal: 76, protein: 8, carbs: 1.9, fat: 4.8, serving: 100, servingLabel: '100 g' },
  { id: 'soya-chunks', name: 'Soya Chunks (dry)', emoji: '🟤', kcal: 345, protein: 52, carbs: 33, fat: 0.5, serving: 40, servingLabel: '40 g dry' },
  { id: 'whey-scoop', name: 'Whey Protein (scoop)', emoji: '🥤', kcal: 400, protein: 80, carbs: 8, fat: 6, serving: 30, servingLabel: '1 scoop' },
  { id: 'peanut-butter', name: 'Peanut Butter', emoji: '🥜', kcal: 588, protein: 25, carbs: 20, fat: 50, serving: 16, servingLabel: '1 tbsp' },
  { id: 'peanuts-roasted', name: 'Peanuts (roasted)', emoji: '🥜', kcal: 567, protein: 26, carbs: 16, fat: 49, serving: 30, servingLabel: '1 handful' },
  { id: 'almonds', name: 'Almonds', emoji: '🌰', kcal: 579, protein: 21, carbs: 22, fat: 50, serving: 15, servingLabel: '10 almonds' },
  { id: 'walnuts', name: 'Walnuts', emoji: '🌰', kcal: 654, protein: 15, carbs: 14, fat: 65, serving: 15, servingLabel: '3 halves' },
  { id: 'chana-roasted', name: 'Roasted Chana', emoji: '🫘', kcal: 369, protein: 19, carbs: 58, fat: 6, serving: 30, servingLabel: '1 handful' },
  { id: 'sprouts', name: 'Moong Sprouts', emoji: '🌱', kcal: 30, protein: 3, carbs: 6, fat: 0.2, serving: 100, servingLabel: '1 bowl' },

  // ── Dairy & drinks ────────────────────────────────────────────────
  { id: 'milk-toned', name: 'Milk (toned)', emoji: '🥛', kcal: 58, protein: 3.1, carbs: 4.7, fat: 3, serving: 200, servingLabel: '1 glass' },
  { id: 'milk-full', name: 'Milk (full cream)', emoji: '🥛', kcal: 67, protein: 3.2, carbs: 4.6, fat: 4, serving: 200, servingLabel: '1 glass' },
  { id: 'buttermilk', name: 'Buttermilk / Chaas', emoji: '🥛', kcal: 25, protein: 1.5, carbs: 2.5, fat: 1, serving: 200, servingLabel: '1 glass' },
  { id: 'lassi-sweet', name: 'Lassi (sweet)', emoji: '🥤', kcal: 108, protein: 2.7, carbs: 15, fat: 4, serving: 200, servingLabel: '1 glass' },
  { id: 'greek-yogurt', name: 'Greek Yogurt (plain)', emoji: '🥛', kcal: 59, protein: 10, carbs: 3.6, fat: 0.4, serving: 150, servingLabel: '1 cup' },
  { id: 'chai', name: 'Chai (milk + sugar)', emoji: '☕', kcal: 60, protein: 1.7, carbs: 9, fat: 2, serving: 150, servingLabel: '1 cup' },
  { id: 'coffee-black', name: 'Black Coffee', emoji: '☕', kcal: 2, protein: 0.1, carbs: 0, fat: 0, serving: 200, servingLabel: '1 cup' },
  { id: 'green-tea', name: 'Green Tea / Moringa', emoji: '🍵', kcal: 1, protein: 0, carbs: 0, fat: 0, serving: 200, servingLabel: '1 cup' },
  { id: 'coconut-water', name: 'Coconut Water', emoji: '🥥', kcal: 19, protein: 0.7, carbs: 3.7, fat: 0.2, serving: 250, servingLabel: '1 glass' },
  { id: 'cold-drink', name: 'Cold Drink (cola)', emoji: '🥤', kcal: 42, protein: 0, carbs: 10.6, fat: 0, serving: 300, servingLabel: '1 can/glass' },
  { id: 'fruit-juice', name: 'Fruit Juice (packaged)', emoji: '🧃', kcal: 48, protein: 0.3, carbs: 11.5, fat: 0.1, serving: 200, servingLabel: '1 glass' },

  // ── Grains, breads & breakfast ────────────────────────────────────
  { id: 'oats-dry', name: 'Oats (dry)', emoji: '🥣', kcal: 389, protein: 17, carbs: 66, fat: 7, serving: 40, servingLabel: '40 g bowl' },
  { id: 'muesli', name: 'Muesli', emoji: '🥣', kcal: 380, protein: 10, carbs: 68, fat: 7, serving: 45, servingLabel: '45 g bowl' },
  { id: 'cornflakes', name: 'Cornflakes', emoji: '🥣', kcal: 378, protein: 7, carbs: 84, fat: 0.9, serving: 30, servingLabel: '1 bowl' },
  { id: 'bread-white', name: 'Bread (white)', emoji: '🍞', kcal: 265, protein: 9, carbs: 49, fat: 3.2, serving: 25, servingLabel: '1 slice' },
  { id: 'bread-brown', name: 'Bread (brown/multigrain)', emoji: '🍞', kcal: 250, protein: 11, carbs: 43, fat: 4, serving: 28, servingLabel: '1 slice' },
  { id: 'daliya', name: 'Daliya (cooked)', emoji: '🥣', kcal: 85, protein: 3, carbs: 17, fat: 0.5, serving: 200, servingLabel: '1 bowl' },
  { id: 'besan-chilla', name: 'Besan Chilla', emoji: '🥞', kcal: 175, protein: 8, carbs: 20, fat: 7, serving: 70, servingLabel: '1 chilla' },
  { id: 'chia-seeds', name: 'Chia Seeds', emoji: '🌾', kcal: 486, protein: 17, carbs: 42, fat: 31, serving: 15, servingLabel: '15 g' },
  { id: 'isabgol', name: 'Isabgol (psyllium)', emoji: '🌾', kcal: 190, protein: 1.5, carbs: 85, fat: 0.5, serving: 10, servingLabel: '1 tbsp' },
  { id: 'honey', name: 'Honey', emoji: '🍯', kcal: 304, protein: 0.3, carbs: 82, fat: 0, serving: 20, servingLabel: '1 tbsp' },
  { id: 'ghee', name: 'Ghee', emoji: '🧈', kcal: 900, protein: 0, carbs: 0, fat: 100, serving: 12, servingLabel: '1 tbsp' },
  { id: 'butter', name: 'Butter', emoji: '🧈', kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, serving: 10, servingLabel: '1 tbsp' },

  // ── Fruits & veg ──────────────────────────────────────────────────
  { id: 'banana', name: 'Banana', emoji: '🍌', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, serving: 120, servingLabel: '1 medium' },
  { id: 'apple', name: 'Apple', emoji: '🍎', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, serving: 180, servingLabel: '1 medium' },
  { id: 'mango', name: 'Mango', emoji: '🥭', kcal: 60, protein: 0.8, carbs: 15, fat: 0.4, serving: 200, servingLabel: '1 cup' },
  { id: 'orange', name: 'Orange / Mosambi', emoji: '🍊', kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, serving: 150, servingLabel: '1 fruit' },
  { id: 'papaya', name: 'Papaya', emoji: '🍈', kcal: 43, protein: 0.5, carbs: 11, fat: 0.3, serving: 200, servingLabel: '1 bowl' },
  { id: 'watermelon', name: 'Watermelon', emoji: '🍉', kcal: 30, protein: 0.6, carbs: 8, fat: 0.2, serving: 250, servingLabel: '1 bowl' },
  { id: 'grapes', name: 'Grapes', emoji: '🍇', kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, serving: 100, servingLabel: '1 bowl' },
  { id: 'pomegranate', name: 'Pomegranate', emoji: '🔴', kcal: 83, protein: 1.7, carbs: 19, fat: 1.2, serving: 150, servingLabel: '1 fruit' },
  { id: 'guava', name: 'Guava', emoji: '🟢', kcal: 68, protein: 2.6, carbs: 14, fat: 1, serving: 150, servingLabel: '1 fruit' },
  { id: 'cucumber', name: 'Cucumber', emoji: '🥒', kcal: 16, protein: 0.7, carbs: 3.6, fat: 0.1, serving: 150, servingLabel: '1 whole' },
  { id: 'carrot', name: 'Carrot', emoji: '🥕', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, serving: 100, servingLabel: '1 medium' },
  { id: 'tomato', name: 'Tomato', emoji: '🍅', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, serving: 100, servingLabel: '1 medium' },
  { id: 'potato-boiled', name: 'Potato (boiled)', emoji: '🥔', kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, serving: 150, servingLabel: '1 medium' },
  { id: 'sweet-potato', name: 'Sweet Potato (boiled)', emoji: '🍠', kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, serving: 150, servingLabel: '1 medium' },
  { id: 'salad-plate', name: 'Salad (cucumber/onion/tomato)', emoji: '🥗', kcal: 25, protein: 1, carbs: 5, fat: 0.2, serving: 150, servingLabel: '1 plate' },
  { id: 'broccoli', name: 'Broccoli (steamed)', emoji: '🥦', kcal: 35, protein: 2.4, carbs: 7, fat: 0.4, serving: 100, servingLabel: '1 cup' },
  { id: 'spinach', name: 'Spinach (cooked)', emoji: '🥬', kcal: 23, protein: 3, carbs: 3.8, fat: 0.3, serving: 100, servingLabel: '1 katori' },

  // ── Snacks, street & fast food ────────────────────────────────────
  { id: 'samosa', name: 'Samosa', emoji: '🥟', kcal: 308, protein: 5, carbs: 32, fat: 18, serving: 100, servingLabel: '1 samosa' },
  { id: 'pakora', name: 'Pakora', emoji: '🧆', kcal: 315, protein: 7, carbs: 28, fat: 20, serving: 80, servingLabel: '4-5 pieces' },
  { id: 'vada-pav', name: 'Vada Pav', emoji: '🍔', kcal: 290, protein: 6, carbs: 40, fat: 12, serving: 150, servingLabel: '1 vada pav' },
  { id: 'pav-bhaji', name: 'Pav Bhaji', emoji: '🍛', kcal: 160, protein: 4, carbs: 20, fat: 7, serving: 300, servingLabel: '1 plate' },
  { id: 'momos-steamed', name: 'Momos (steamed)', emoji: '🥟', kcal: 190, protein: 7, carbs: 30, fat: 5, serving: 150, servingLabel: '6 momos' },
  { id: 'maggi', name: 'Maggi (cooked)', emoji: '🍜', kcal: 155, protein: 3.5, carbs: 20, fat: 7, serving: 250, servingLabel: '1 pack cooked' },
  { id: 'pizza-slice', name: 'Pizza (slice)', emoji: '🍕', kcal: 266, protein: 11, carbs: 33, fat: 10, serving: 110, servingLabel: '1 slice' },
  { id: 'burger', name: 'Burger (chicken)', emoji: '🍔', kcal: 250, protein: 12, carbs: 28, fat: 10, serving: 180, servingLabel: '1 burger' },
  { id: 'french-fries', name: 'French Fries', emoji: '🍟', kcal: 312, protein: 3.4, carbs: 41, fat: 15, serving: 100, servingLabel: '1 medium' },
  { id: 'biscuits-marie', name: 'Marie Biscuits', emoji: '🍪', kcal: 450, protein: 7, carbs: 75, fat: 13, serving: 20, servingLabel: '4 biscuits' },
  { id: 'parle-g', name: 'Parle-G', emoji: '🍪', kcal: 470, protein: 6.6, carbs: 77, fat: 15, serving: 25, servingLabel: '5 biscuits' },
  { id: 'namkeen', name: 'Namkeen / Bhujia', emoji: '🥨', kcal: 550, protein: 12, carbs: 45, fat: 36, serving: 30, servingLabel: '1 handful' },
  { id: 'chips', name: 'Chips (potato)', emoji: '🥔', kcal: 536, protein: 7, carbs: 53, fat: 34, serving: 30, servingLabel: 'small pack' },
  { id: 'chocolate', name: 'Chocolate (milk)', emoji: '🍫', kcal: 535, protein: 7.6, carbs: 59, fat: 30, serving: 25, servingLabel: '1 small bar' },
  { id: 'dark-chocolate', name: 'Dark Chocolate (70%)', emoji: '🍫', kcal: 598, protein: 7.8, carbs: 46, fat: 43, serving: 20, servingLabel: '2 squares' },
  { id: 'ice-cream', name: 'Ice Cream (vanilla)', emoji: '🍨', kcal: 207, protein: 3.5, carbs: 24, fat: 11, serving: 100, servingLabel: '1 scoop' },
  { id: 'gulab-jamun', name: 'Gulab Jamun', emoji: '🟤', kcal: 320, protein: 4, carbs: 48, fat: 12, serving: 50, servingLabel: '1 piece' },
  { id: 'jalebi', name: 'Jalebi', emoji: '🟠', kcal: 450, protein: 3, carbs: 70, fat: 18, serving: 50, servingLabel: '2 pieces' },
  { id: 'kheer', name: 'Kheer', emoji: '🥣', kcal: 140, protein: 3.5, carbs: 22, fat: 4.5, serving: 150, servingLabel: '1 katori' },
  { id: 'popcorn', name: 'Popcorn (plain)', emoji: '🍿', kcal: 387, protein: 12, carbs: 74, fat: 4.5, serving: 30, servingLabel: '1 bowl' },
  { id: 'makhana', name: 'Makhana (roasted)', emoji: '⚪', kcal: 350, protein: 9.7, carbs: 77, fat: 0.1, serving: 25, servingLabel: '1 bowl' },
  { id: 'dates', name: 'Dates', emoji: '🌴', kcal: 282, protein: 2.5, carbs: 75, fat: 0.4, serving: 24, servingLabel: '3 dates' },
  { id: 'raisins', name: 'Raisins', emoji: '🍇', kcal: 299, protein: 3.1, carbs: 79, fat: 0.5, serving: 15, servingLabel: '1 tbsp' },
]

export const FOOD_MAP: ReadonlyMap<string, FoodItem> = new Map(FOODS.map((f) => [f.id, f]))

export function searchFoods(q: string, limit = 30): FoodItem[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return FOODS.slice(0, limit)
  const starts: FoodItem[] = []
  const contains: FoodItem[] = []
  for (const f of FOODS) {
    const name = f.name.toLowerCase()
    if (name.startsWith(needle)) starts.push(f)
    else if (name.includes(needle)) contains.push(f)
  }
  return [...starts, ...contains].slice(0, limit)
}
