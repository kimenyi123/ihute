"use client";

import type { ImageFile } from "./UploadZone";
import { Button } from "@/components/ui/button";

interface ImagePreviewListProps {
  files: ImageFile[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function ImagePreviewList({
  files,
  onRemove,
  disabled,
}: ImagePreviewListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        Uploaded images ({files.length}) — remove before processing
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {files.map((img, index) => (
          <div
            key={img.id}
            className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-[3/4]"
          >
            <img
              src={img.preview}
              alt={`Page ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <span className="text-white text-xs font-medium">
                Page {index + 1}
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => onRemove(img.id)}
                disabled={disabled}
                className="text-xs"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
