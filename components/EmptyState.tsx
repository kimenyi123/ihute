/**
 * Empty State Component
 * Display "No items found" with icon
 * Task 8.3 - Requirements 13.4, 16.1, 18.1, 19.1
 */

interface EmptyStateProps {
  message?: string;
  icon?: "box" | "document" | "search";
}

export default function EmptyState({ 
  message = "No items found", 
  icon = "box" 
}: EmptyStateProps) {
  const icons = {
    box: (
      <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    document: (
      <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    search: (
      <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {icons[icon]}
      <p className="mt-4 text-gray-600 text-center">{message}</p>
    </div>
  );
}
