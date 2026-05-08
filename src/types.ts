export interface ShoppingItem {
  id: string;
  text: string;
  checked: boolean;
  catName: string;
  catColor: string;
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
