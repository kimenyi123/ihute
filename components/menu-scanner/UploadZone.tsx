"use client";

import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
};

export interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

interface UploadZoneProps {
  onFiles: (files: ImageFile[]) => void;
  existingFiles: ImageFile[];
  disabled?: boolean;
}

export function UploadZone({
  onFiles,
  existingFiles,
  disabled,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const valid = newFiles.filter((f) => f.size <= MAX_SIZE);
      const added: ImageFile[] = valid.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        preview: URL.createObjectURL(f),
      }));
      onFiles([...existingFiles, ...added]);
    },
    [existingFiles, onFiles]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      addFiles(accepted);
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_SIZE,
    multiple: true,
    disabled,
    noClick: false,
  });

  const handleCamera = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    addFiles(files);
    e.target.value = "";
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors border-border bg-muted/50 hover:bg-muted
          ${isDragActive ? "border-primary bg-primary/10" : ""}
          ${disabled ? "opacity-60 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          capture="environment"
          className="hidden"
          onChange={handleFileInput}
        />
        <p className="text-foreground font-medium">
          {isDragActive
            ? "Drop images here"
            : "Drag & drop menu photos here, or click to select"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          JPG, PNG, WEBP, HEIC — max 20MB per image
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            handleCamera();
          }}
          disabled={disabled}
          className="mt-4"
        >
          📷 Open camera / Choose files
        </Button>
      </div>
    </div>
  );
}
