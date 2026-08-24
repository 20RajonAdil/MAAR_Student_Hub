import { Sigma, BookOpen, Leaf, FlaskConical, Atom, Book, LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Sigma,
  BookOpen,
  Leaf,
  FlaskConical,
  Atom,
  Book,
};

export function icon(name: string): LucideIcon {
  return MAP[name] ?? Book;
}
