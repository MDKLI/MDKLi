import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { useWishlistStore, type WishlistItemType } from '@/stores/wishlist-store'
import { toast } from 'sonner'

interface WishlistButtonProps {
  id: string
  type: WishlistItemType
  name: string
  subtitle?: string
  imageUrl?: string
  url: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function WishlistButton({
  id,
  type,
  name,
  subtitle,
  imageUrl,
  url,
  variant = 'outline',
  size = 'icon',
  className = '',
}: WishlistButtonProps) {
  const { isInWishlist, toggleItem } = useWishlistStore()
  const isSaved = isInWishlist(id)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    toggleItem({
      id,
      type,
      name,
      subtitle,
      imageUrl,
      url,
    })

    if (isSaved) {
      toast.success(`${name} removed from wishlist`)
    } else {
      toast.success(`${name} added to wishlist`)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={`${className} ${isSaved ? 'text-red-500 hover:text-red-600' : ''}`}
      onClick={handleClick}
    >
      <Heart
        className={`h-5 w-5 transition-all ${
          isSaved ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
        }`}
      />
    </Button>
  )
}
