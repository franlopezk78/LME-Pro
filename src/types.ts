export interface ShoppingItem {
  id: string;
  text: string;
  checked: boolean;
  catName: string;
  catColor: string;
  quantity: number;
  isFavorite: boolean;
  boughtAt?: number; // Fecha de compra para la despensa
}

export interface CatalogProduct {
  n: string;
  e: string;
}

export interface CatalogCategory {
  c: string;
  col: string;
  items: CatalogProduct[];
}

export interface Recipe {
  title: string;
  description: string;
  ingredients: string[];
  missing: string[];
}
