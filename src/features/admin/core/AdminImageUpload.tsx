import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Image, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function readableNameFromImageKey(imageKey: string): string {
	const tail = imageKey.split("/").pop() ?? imageKey;
	try {
		return decodeURIComponent(tail);
	} catch {
		return tail;
	}
}

export function AdminImageUpload({
	label,
	selectedFile,
	onSelectedFileChange,
	existingImageKey,
	existingImageUrl,
	existingImageAlt,
	removeExisting,
	onRemoveExistingChange,
	accept = "image/png,image/jpeg,image/webp",
	formatsLabel = "JPG, PNG or WebP",
	helpText = "Click to choose an image",
	saveHint = "Changes apply when you save.",
}: {
	label: string;
	selectedFile: File | null;
	onSelectedFileChange: (file: File | null) => void;
	existingImageKey?: string | null;
	existingImageUrl?: string | null;
	existingImageAlt?: string;
	removeExisting?: boolean;
	onRemoveExistingChange?: (next: boolean) => void;
	accept?: string;
	formatsLabel?: string;
	helpText?: string;
	saveHint?: string;
}) {
	const generatedId = useId();
	const inputId = `${generatedId}-image`;
	const helpId = `${generatedId}-image-help`;
	const inputRef = useRef<HTMLInputElement | null>(null);
	const dragDepthRef = useRef(0);
	const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const hasExistingImage = !!existingImageKey && !!existingImageUrl && !removeExisting;
	const hasSelectedImage = !!selectedFile;
	const visiblePreviewUrl = hasSelectedImage ? selectedPreviewUrl : existingImageUrl ?? null;
	const visibleName = hasSelectedImage
		? selectedFile?.name ?? "Selected image"
		: existingImageKey
			? readableNameFromImageKey(existingImageKey)
			: null;

	const allowedMimeTypes = useMemo(() => {
		return new Set(
			accept
				.split(",")
				.map((value) => value.trim().toLowerCase())
				.filter((value) => value.length > 0),
		);
	}, [accept]);

	useEffect(() => {
		if (!selectedFile) {
			setSelectedPreviewUrl(null);
			return;
		}

		const nextUrl = URL.createObjectURL(selectedFile);
		setSelectedPreviewUrl(nextUrl);
		return () => URL.revokeObjectURL(nextUrl);
	}, [selectedFile]);

	function openPicker() {
		inputRef.current?.click();
	}

	function setFile(file: File | null) {
		onSelectedFileChange(file);
		if (file && onRemoveExistingChange) {
			onRemoveExistingChange(false);
		}
	}

	function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
		const next = event.target.files?.[0] ?? null;
		setFile(next);
		event.target.value = "";
	}

	function onDrop(event: React.DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = 0;
		setIsDragging(false);

		const dropped = event.dataTransfer.files?.[0];
		if (!dropped) return;

		const droppedType = dropped.type.toLowerCase();
		if (allowedMimeTypes.size > 0 && !allowedMimeTypes.has(droppedType)) {
			return;
		}

		setFile(dropped);
	}

	function onDragEnter(event: React.DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current += 1;
		setIsDragging(true);
	}

	function onDragLeave(event: React.DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
		if (dragDepthRef.current === 0) {
			setIsDragging(false);
		}
	}

	function onDragOver(event: React.DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
	}

	const showPreviewCard = !!visiblePreviewUrl && (!!hasSelectedImage || !!hasExistingImage);

	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={inputId} className="text-sm font-medium">
				{label}
			</label>

			<input
				id={inputId}
				ref={inputRef}
				type="file"
				accept={accept}
				onChange={onInputChange}
				className="sr-only"
				aria-describedby={helpId}
			/>

			{showPreviewCard ? (
				<div className="space-y-3 rounded-xl border border-brand-border bg-brand-surface p-3">
					<img
						src={visiblePreviewUrl}
						alt={existingImageAlt ?? `${label} preview`}
						className="h-28 w-full rounded-lg object-cover"
					/>
					<div className="space-y-1">
						<p className="truncate text-sm font-medium">{visibleName ?? "Image"}</p>
						<p id={helpId} className="text-xs text-brand-muted">
							{hasSelectedImage ? saveHint : "Currently saved image."}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={openPicker}
						>
							Replace image
						</Button>
						{hasSelectedImage ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onSelectedFileChange(null)}
							>
								Remove
							</Button>
						) : onRemoveExistingChange && existingImageKey ? (
							<Button
								type="button"
								variant={removeExisting ? "secondary" : "outline"}
								size="sm"
								onClick={() => onRemoveExistingChange(!removeExisting)}
							>
								{removeExisting ? "Keep existing image" : "Remove existing image"}
							</Button>
						) : null}
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={openPicker}
					onDragEnter={onDragEnter}
					onDragLeave={onDragLeave}
					onDragOver={onDragOver}
					onDrop={onDrop}
					className={cn(
						"group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-surface-raised px-4 py-6 text-center transition-colors",
						"hover:border-brand-secondary hover:bg-brand-surface",
						"focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-background",
						isDragging && "border-brand-secondary bg-brand-surface",
					)}
					aria-describedby={helpId}
				>
					<div className="mb-2 inline-flex rounded-full bg-brand-surface p-2 text-brand-secondary">
						<Image className="size-5" aria-hidden />
					</div>
					<p className="text-sm font-semibold text-brand-secondary group-hover:text-brand-text">
						Upload image
					</p>
					<p id={helpId} className="mt-1 text-xs text-brand-muted">
						{helpText}
					</p>
					<p className="mt-2 inline-flex items-center gap-1 text-xs text-brand-muted">
						<Upload className="size-3.5" aria-hidden />
						{formatsLabel}
					</p>
				</button>
			)}

			{!hasSelectedImage && onRemoveExistingChange && existingImageKey && removeExisting && (
				<div>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={() => onRemoveExistingChange(false)}
					>
						Keep existing image
					</Button>
				</div>
			)}

			{removeExisting && !selectedFile && existingImageKey && (
				<p className="text-xs text-brand-muted">Existing image will be removed when you save.</p>
			)}
		</div>
	);
}