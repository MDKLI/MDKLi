import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { MapPin, Phone, Clock, CheckCircle, ArrowLeft, Building2, Users } from 'lucide-react'
import { searchApi } from '@/lib/search-api'
import { bookingApi } from '@/lib/api'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'
import { chatApi } from '@/lib/chat-api'
import { WishlistButton } from '@/components/wishlist-button'

interface FacilityDetails {
  id: string
  user_id?: string
  facility_name: string
  facility_type: string | null
  description: string | null
  photo_url: string | null
  phone_numbers: string[]
  address: string | null
  city: string | null
  area: string | null
  status: string
  username?: string
}

interface BranchDoctor {
  id: string
  fullName: string
  email: string
  specialty: string
  title: string
  photoUrl: string
}

interface FacilityBranch {
  id: string
  name: string
  city: string
  area: string
  address: string
  doctors: BranchDoctor[]
}

export const Route = createFileRoute('/_authenticated/fc/$username')({
  component: FacilityDetailPage,
})

function FacilityDetailPage() {
  const { username } = Route.useParams()
  const navigate = Route.useNavigate()
  const [facility, setFacility] = useState<FacilityDetails | null>(null)
  const [branches, setBranches] = useState<FacilityBranch[]>([])
  const [loading, setLoading] = useState(true)
  const [startingChat, setStartingChat] = useState(false)

  useEffect(() => {
    fetchFacilityDetails()
  }, [username])

  const fetchFacilityDetails = async () => {
    try {
      setLoading(true)
      const data = await searchApi.searchFacilities('*', {
        facility_role: 'clinic',
        limit: 100
      })

      const found = data.data?.find((f: any) =>
        f.facility_name?.toLowerCase().replace(/\s+/g, '-') === username?.toLowerCase() ||
        f.id === username ||
        f.user_id === username
      )

      if (found) {
        setFacility({ ...found, username })
        await fetchBranchesWithDoctors(found.user_id || found.id)
      } else {
        toast.error('Facility not found')
      }
    } catch (error) {
      console.error('Failed to fetch facility:', error)
      toast.error('Failed to load facility details')
    } finally {
      setLoading(false)
    }
  }

  const fetchBranchesWithDoctors = async (facilityUserId: string) => {
    try {
      const result = await bookingApi.getFacilityBranchesForPublic(facilityUserId)
      if (result.error || !result.data?.success) {
        setBranches([])
        return
      }
      setBranches(result.data.data)
    } catch {
      setBranches([])
    }
  }

  const handleChat = async () => {
    if (!facility) return
    setStartingChat(true)
    try {
      const targetId = facility.user_id || facility.id
      const result = await chatApi.openRoomWith(targetId)
      if (result.data) {
        navigate({ to: '/chats', search: { room: result.data.id } as any })
      } else {
        toast.error(result.error || 'Failed to start chat')
      }
    } finally {
      setStartingChat(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!facility) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Facility Not Found</h1>
        <p className="text-muted-foreground">The hospital or medical center you're looking for doesn't exist.</p>
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
      <Link to="/search" search={{ mode: 'facilities' } as any}>
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Search
        </Button>
      </Link>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="h-32 w-32 rounded-xl flex-shrink-0">
              <AvatarImage src={facility.photo_url || undefined} className="rounded-xl object-cover" />
              <AvatarFallback className="text-4xl rounded-xl bg-blue-500 text-white">
                {facility.facility_name?.charAt(0).toUpperCase() || 'F'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{facility.facility_name}</h1>
                {facility.status === 'verified' ? (
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
                <WishlistButton
                  id={facility.id}
                  type="clinic"
                  name={facility.facility_name}
                  subtitle={facility.facility_type || ''}
                  imageUrl={facility.photo_url || undefined}
                  url={`/fc/${facility.username || facility.id}`}
                  variant="outline"
                  size="icon"
                  className="ml-auto"
                />
                <Button onClick={handleChat} disabled={startingChat} size="sm">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {startingChat ? 'Starting...' : 'Chat'}
                </Button>
              </div>

              {facility.facility_type && (
                <Badge variant="outline" className="mb-4">{facility.facility_type}</Badge>
              )}

              {facility.description && (
                <p className="text-muted-foreground mb-4">{facility.description}</p>
              )}

              <div className="flex flex-wrap gap-4">
                {facility.phone_numbers?.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{facility.phone_numbers[0]}</span>
                  </div>
                )}
                {(facility.city || facility.area) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{[facility.area, facility.city].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>About</CardTitle></CardHeader>
            <CardContent>
              {facility.description ? (
                <p>{facility.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branches & Doctors ({branches.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {branches.length > 0 ? (
                <div className="space-y-6">
                  {branches.map((branch) => (
                    <div key={branch.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold">{branch.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {[branch.area, branch.city].filter(Boolean).join(', ') || 'Location not specified'}
                          </p>
                          {branch.address && (
                            <p className="text-sm text-muted-foreground mt-1">{branch.address}</p>
                          )}
                        </div>
                        <Badge variant="outline">
                          <Users className="h-3 w-3 mr-1" />
                          {branch.doctors.length} doctors
                        </Badge>
                      </div>

                      {branch.doctors.length > 0 ? (
                        <div className="space-y-2 mt-4 pl-8">
                          {branch.doctors.map((doctor) => (
                            <div key={doctor.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={doctor.photoUrl} />
                                  <AvatarFallback>{doctor.fullName?.charAt(0) || 'D'}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">Dr. {doctor.fullName}</p>
                                  <div className="flex gap-2 mt-0.5">
                                    {doctor.specialty && (
                                      <Badge variant="secondary" className="text-xs">{doctor.specialty}</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Link to="/dr/$username" params={{ username: doctor.id }}>
                                <Button variant="outline" size="sm">View</Button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground pl-8">No doctors assigned to this branch yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No branches listed</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {facility.phone_numbers?.length > 0 ? (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{facility.phone_numbers[0]}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic">No phone number</p>
              )}

              <Separator />

              {(facility.city || facility.area) && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{[facility.area, facility.city].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              )}

              {facility.address && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{facility.address}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Verification Status</CardTitle></CardHeader>
            <CardContent>
              {facility.status === 'verified' ? (
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle className="h-8 w-8" />
                  <div>
                    <p className="font-semibold">Verified Facility</p>
                    <p className="text-sm">This facility has been verified by our team</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-amber-600">
                  <Clock className="h-8 w-8" />
                  <div>
                    <p className="font-semibold">Pending Verification</p>
                    <p className="text-sm">This facility is awaiting verification</p>
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
