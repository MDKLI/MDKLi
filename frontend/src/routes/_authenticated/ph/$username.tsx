import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { MapPin, Phone, Clock, CheckCircle, ArrowLeft, Building2 } from 'lucide-react'
import { searchApi } from '@/lib/search-api'
import { toast } from 'sonner'

interface PharmacyDetails {
  id: string
  facility_name: string
  facility_type: string
  description: string | null
  photo_url: string | null
  phone_numbers: string[]
  address: string | null
  city: string | null
  area: string | null
  status: string
  branches: any[]
  username?: string
}

export const Route = createFileRoute('/_authenticated/ph/$username')({
  component: PharmacyDetailPage,
})

function PharmacyDetailPage() {
  const { username } = Route.useParams()
  const [pharmacy, setPharmacy] = useState<PharmacyDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPharmacyDetails()
  }, [username])

  const fetchPharmacyDetails = async () => {
    try {
      setLoading(true)
      // Search for pharmacy by name (since we don't have username in search db yet)
      const data = await searchApi.searchFacilities('*', { 
        facility_role: 'pharmacy',
        limit: 100 
      })
      
      // Find pharmacy by matching username with facility_name or user_id
      const found = data.data?.find((p: any) => 
        p.facility_name?.toLowerCase() === username?.toLowerCase() ||
        p.id === username
      )
      
      if (found) {
        setPharmacy({ ...found, username })
      } else {
        toast.error('Pharmacy not found')
      }
    } catch (error) {
      console.error('Failed to fetch pharmacy:', error)
      toast.error('Failed to load pharmacy details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!pharmacy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Pharmacy Not Found</h1>
        <p className="text-muted-foreground">The pharmacy you're looking for doesn't exist.</p>
        <Link to="/search">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Back Button */}
      <Link to="/search" search={{ mode: 'pharmacy' }}>
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pharmacy Search
        </Button>
      </Link>

      {/* Header Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Pharmacy Photo */}
            <Avatar className="h-32 w-32 rounded-xl flex-shrink-0">
              <AvatarImage 
                src={pharmacy.photo_url || undefined} 
                className="rounded-xl object-cover"
              />
              <AvatarFallback className="text-4xl rounded-xl bg-blue-500 text-white">
                {pharmacy.facility_name?.charAt(0).toUpperCase() || 'P'}
              </AvatarFallback>
            </Avatar>

            {/* Pharmacy Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{pharmacy.facility_name}</h1>
                {pharmacy.status === 'verified' ? (
                  <Badge className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
              
              {pharmacy.facility_type && (
                <Badge variant="outline" className="mb-4">
                  {pharmacy.facility_type}
                </Badge>
              )}

              {pharmacy.description && (
                <p className="text-muted-foreground mb-4">{pharmacy.description}</p>
              )}

              {/* Contact Info */}
              <div className="flex flex-wrap gap-4">
                {pharmacy.phone_numbers?.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{pharmacy.phone_numbers[0]}</span>
                  </div>
                )}
                {(pharmacy.city || pharmacy.area) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{[pharmacy.area, pharmacy.city].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          {/* About Section */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              {pharmacy.description ? (
                <p>{pharmacy.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description available</p>
              )}
            </CardContent>
          </Card>

          {/* Branches Section */}
          <Card>
            <CardHeader>
              <CardTitle>Branches ({pharmacy.branches?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {pharmacy.branches?.length > 0 ? (
                <div className="space-y-4">
                  {pharmacy.branches.map((branch: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold">{branch.name || `Branch ${index + 1}`}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {[branch.area, branch.city].filter(Boolean).join(', ') || 'Location not specified'}
                          </p>
                          {branch.address && (
                            <p className="text-sm text-muted-foreground mt-1">{branch.address}</p>
                          )}
                          {branch.phone_numbers?.length > 0 && (
                            <div className="flex items-center gap-2 mt-2 text-sm">
                              <Phone className="h-3 w-3" />
                              <span>{branch.phone_numbers.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No branches listed</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pharmacy.phone_numbers?.length > 0 ? (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{pharmacy.phone_numbers[0]}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic">No phone number</p>
              )}
              
              <Separator />
              
              {(pharmacy.city || pharmacy.area) && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">
                      {[pharmacy.area, pharmacy.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}
              
              {pharmacy.address && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{pharmacy.address}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
            </CardHeader>
            <CardContent>
              {pharmacy.status === 'verified' ? (
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle className="h-8 w-8" />
                  <div>
                    <p className="font-semibold">Verified Pharmacy</p>
                    <p className="text-sm">This pharmacy has been verified by our team</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-amber-600">
                  <Clock className="h-8 w-8" />
                  <div>
                    <p className="font-semibold">Pending Verification</p>
                    <p className="text-sm">This pharmacy is awaiting verification</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
