export interface ShoppingItem {
  id: string;
  text: string;
  checked: boolean;
  catName: string;
  catColor: string;
  quantity: number;
  isFavorite: boolean;
  price?: number;
  priceTrend?: 'up' | 'down' | 'equal';
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

export interface PriceHistory {
  [productName: string]: number;
}
