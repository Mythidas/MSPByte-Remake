import SearchBar from "@/components/SearchBar";
import { Search } from "lucide-react";

export default function DataTableSearch({
  enableSearch,
  searchPlaceholder,
  searchTerm,
  handleSearchChange,
}: {
  enableSearch: boolean;
  searchPlaceholder: string;
  searchTerm: string;
  handleSearchChange: (term: string) => void;
}) {
  if (!enableSearch) return null;

  return (
    <SearchBar
      placeholder={searchPlaceholder}
      lead={<Search className="w-4 h-4" />}
      onSearch={handleSearchChange}
      className="max-w-sm"
      defaultValue={searchTerm}
      delay={1000}
    />
  );
}
