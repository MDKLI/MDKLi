import { useRef, useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface ImageCropperProps {
	imageSrc: string;
	isOpen: boolean;
	onClose: () => void;
	onCropComplete: (croppedImage: string) => void;
}

export function ImageCropper({
	imageSrc,
	isOpen,
	onClose,
	onCropComplete,
}: ImageCropperProps) {
	const [crop, setCrop] = useState<Crop>({
		unit: "px",
		width: 300,
		height: 300,
		x: 0,
		y: 0,
	});
	const [zoom, setZoom] = useState(1);
	const imageRef = useRef<HTMLImageElement>(null);

	const getCroppedImg = (image: HTMLImageElement, crop: Crop): string => {
		const canvas = document.createElement("canvas");
		const scaleX = image.naturalWidth / image.width;
		const scaleY = image.naturalHeight / image.height;

		// Use fixed output size for consistent profile pictures
		const outputWidth = 300;
		const outputHeight = 300;
		canvas.width = outputWidth;
		canvas.height = outputHeight;
		const ctx = canvas.getContext("2d");

		if (!ctx) return imageSrc;

		// Calculate source coordinates
		const sourceX = crop.x * scaleX;
		const sourceY = crop.y * scaleY;
		const sourceWidth = crop.width * scaleX;
		const sourceHeight = crop.height * scaleY;

		// Draw without white background
		ctx.drawImage(
			image,
			sourceX,
			sourceY,
			sourceWidth,
			sourceHeight,
			0,
			0,
			outputWidth,
			outputHeight,
		);

		return canvas.toDataURL("image/jpeg", 0.9);
	};

	const handleCropComplete = () => {
		if (imageRef.current) {
			const croppedImage = getCroppedImg(imageRef.current, crop);
			onCropComplete(croppedImage);
			onClose();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Crop Profile Picture</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div
						className="relative overflow-hidden rounded-lg border bg-muted"
						style={{
							maxHeight: "400px",
							display: "flex",
							justifyContent: "center",
						}}
					>
						<ReactCrop
							crop={crop}
							onChange={(c) => setCrop(c)}
							aspect={1}
							className="max-w-full"
							minWidth={100}
							minHeight={100}
						>
							<img
								ref={imageRef}
								src={imageSrc}
								alt="Crop preview"
								style={{
									transform: `scale(${zoom})`,
									maxWidth: "100%",
									maxHeight: "400px",
									objectFit: "contain",
								}}
							/>
						</ReactCrop>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span>Zoom</span>
							<span>{Math.round(zoom * 100)}%</span>
						</div>
						<Slider
							value={[zoom]}
							onValueChange={(value: number[]) => setZoom(value[0])}
							min={0.5}
							max={3}
							step={0.1}
						/>
					</div>

					<div className="flex gap-2 justify-end">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={handleCropComplete}>Crop & Save</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
