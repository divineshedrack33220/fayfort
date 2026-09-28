import {
  Footprints,
  Headphones,
  Package,
  Shirt,
  ShoppingBag,
  Smartphone,
  Watch,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Product icon picker for portal cards/list rows. Matches each product name
 * against a small keyword table (case-insensitive substring) so live backend
 * product names map to a sensible icon without a strict enum. Renders the
 * chosen icon directly so no component is created during render.
 */

const ALL: [LucideIcon, string[]][] = [
  [Watch, ["watch", "timepiece"]],
  [Smartphone, ["phone", "phonecase", "tablet", "ipad", "case"]],
  [Headphones, ["headphone", "earbud", "earphone", "audio"]],
  [ShoppingBag, ["bag", "handbag", "purse", "tote", "backpack", "luggage"]],
  [Shirt, ["shirt", "tee", "t-shirt", "tshirt", "apparel", "wear", "fashion"]],
  [Footprints, ["sneaker", "shoe", "footwear", "boot", "sandals"]],
];

export function ProductIcon({
  product,
  ...props
}: { product: string } & LucideProps) {
  const value = product.toLowerCase();
  for (const [Icon, keywords] of ALL) {
    if (keywords.some((keyword) => value.includes(keyword))) {
      return <Icon {...props} aria-hidden />;
    }
  }
  return <Package {...props} aria-hidden />;
}