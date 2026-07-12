import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Heart, Trash2, Stethoscope, Building2, Pill, ArrowLeft } from 'lucide-react'
import { useWishlistStore, type WishlistItem } from '@/stores/wishlist-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/wishlist')({
  component: WishlistPage,
})

function WishlistPage() {
  const { items, removeItem, getDoctors, getPharmacies, getClinics } = useWishlistStore()
  const [activeTab, setActiveTab] = useState('all')

  const doctors = getDoctors()
  const pharmacies = getPharmacies()
  const clinics = getClinics()

  const getFilteredItems = () => {
    switch (activeTab) {
      case 'doctors':
        return doctors
      case 'pharmacies':
        return pharmacies
      case 'clinics':
        return clinics
      default:
        return items
    }
  }

  const filteredItems = getFilteredItems()

  const handleRemove = (item: WishlistItem) => {
    removeItem(item.id)
    toast.success(`${item.name} removed from wishlist`)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'doctor':
        return <Stethoscope className="h-4 w-4" />
      case 'pharmacy':
        return <Pill className="h-4 w-4" />
      case 'clinic':
        return <Building2 className="h-4 w-4" />
      default:
        return <Heart className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'doctor':
        return 'Doctor'
      case 'pharmacy':
        return 'Pharmacy'
      case 'clinic':
        return 'Clinic'
      default:
        return 'Item'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/search">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            My Wishlist
          </h1>
          <p className="text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
            <p className="text-muted-foreground mb-6">
              Start adding doctors, pharmacies, and clinics to your wishlist
            </p>
            <Link to="/search">
              <Button>Browse</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              All ({items.length})
            </TabsTrigger>
            <TabsTrigger value="doctors">
              Doctors ({doctors.length})
            </TabsTrigger>
            <TabsTrigger value="pharmacies">
              Pharmacies ({pharmacies.length})
            </TabsTrigger>
            <TabsTrigger value="clinics">
              Clinics ({clinics.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No {activeTab === 'all' ? 'items' : activeTab} in your wishlist
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Image */}
                        <Avatar className="h-14 w-14 rounded-lg">
                          <AvatarImage src={item.imageUrl} className="rounded-lg object-cover" />
                          <AvatarFallback className="rounded-lg bg-primary text-white text-lg">
                            {item.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{item.name}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {getTypeIcon(item.type)}
                              <span className="ml-1">{getTypeLabel(item.type)}</span>
                            </Badge>
                          </div>
                          {item.subtitle && (
                            <p className="text-sm text-muted-foreground truncate">
                              {item.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Link to={item.url}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemove(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
