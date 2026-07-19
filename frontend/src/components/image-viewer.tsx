import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ImageViewerProps {
	images: string[];
	initialIndex: number;
	isOpen: boolean;
	onClose: () => void;
}

export function ImageViewer({
	images,
	initialIndex,
	isOpen,
	onClose,
}: ImageViewerProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);

	// Reset currentIndex when the viewer opens with a new initialIndex
	useEffect(() => {
		if (isOpen) {
			setCurrentIndex(initialIndex);
		}
	}, [isOpen, initialIndex]);

	const handlePrevious = () => {
		setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
	};

	const handleNext = () => {
		setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-4xl p-0 bg-black/90 border-none">
				<div className="relative flex items-center justify-center min-h-[400px]">
					{/* Close button */}
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
						onClick={onClose}
					>
						<X className="h-6 w-6" />
					</Button>

					{/* Previous button */}
					{images.length > 1 && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute left-2 z-50 text-white hover:bg-white/20"
							onClick={handlePrevious}
						>
							<ChevronLeft className="h-8 w-8" />
						</Button>
					)}

					{/* Image */}
					{images[currentIndex] && (
						<img
							src={images[currentIndex]}
							alt={`${currentIndex + 1} of ${images.length}`}
							className="max-w-full max-h-[80vh] object-contain"
						/>
					)}

					{/* Next button */}
					{images.length > 1 && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute right-2 z-50 text-white hover:bg-white/20"
							onClick={handleNext}
						>
							<ChevronRight className="h-8 w-8" />
						</Button>
					)}

					{/* Image counter */}
					{images.length > 1 && (
						<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded-full text-sm">
							{currentIndex + 1} / {images.length}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
