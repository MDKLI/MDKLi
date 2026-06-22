import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { MapPin, Phone, Clock, CheckCircle, ArrowLeft, Building2, Stethoscope, Award, User } from 'lucide-react'
import { searchApi } from '@/lib/search-api'
import { toast } from 'sonner'

interface DoctorDetails {
  id: string
  full_name: string
  title: string | null
  specialty: string | null
  years_of_experience: string | null
  gender: string | null
  description: string | null
  photo_url: string | null
  phone_number: string | null
  city: string | null
  area: string | null
  verification_status: string
  has_private_practice: boolean
  clinic_name: string | null
  clinic_type: string | null
  branches: any[]
  username?: string
}

export const Route = createFileRoute('/_authenticated/dr/$username')({
  component: DoctorDetailPage,
})

function DoctorDetailPage() {
  const { username } = Route.useParams()
  const [doctor, setDoctor] = useState<DoctorDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDoctorDetails()
  }, [username])

  const fetchDoctorDetails = async () => {
    try {
      setLoading(true)
      // Search for doctor by name
      const data = await searchApi.searchDoctors('*', { 
        limit: 100 
      })
      
      // Find doctor by matching username with full_name or user_id
      const found = data.data?.find((d: any) => 
        d.full_name?.toLowerCase().replace(/\s+/g, '-') === username?.toLowerCase() ||
        d.id === username
      )
      
      if (found) {
        setDoctor({ ...found, username })
      } else {
        toast.error('Doctor not found')
      }
    } catch (error) {
      console.error('Failed to fetch doctor:', error)
      toast.error('Failed to load doctor details')
    } finally {
      setLoading(false)
    }
  }

  // Get first branch for display
  const firstBranch = doctor?.branches?.[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!doctor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Doctor Not Found</h1>
        <p className="text-muted-foreground">The doctor you're looking for doesn't exist.</p>
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
      <Link to="/search" search={{ mode: 'doctors' }}>
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Doctor Search
        </Button>
      </Link>

      {/* Header Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Doctor Photo */}
            <Avatar className="h-32 w-32 rounded-xl flex-shrink-0">
              <AvatarImage 
                src={doctor.photo_url || undefined} 
                className="rounded-xl object-cover"
              />
              <AvatarFallback className="text-4xl rounded-xl bg-primary text-white">
                {doctor.full_name?.charAt(0).toUpperCase() || 'D'}
              </AvatarFallback>
            </Avatar>

            {/* Doctor Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{doctor.full_name}</h1>
                <Badge variant="secondary">
                  {doctor.verification_status === 'verified' ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </>
                  )}
                </Badge>
              </div>
              
              {doctor.title && (
                <p className="text-lg text-muted-foreground mb-2">{doctor.title}</p>
              )}

              {doctor.specialty && (
                <div className="flex items-center gap-2 mb-4">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">
                    {doctor.specialty}
                  </Badge>
                </div>
              )}

              {/* Contact Info */}
              <div className="flex flex-wrap gap-4">
                {doctor.phone_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{doctor.phone_number}</span>
                  </div>
                )}
                {(doctor.city || doctor.area) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{[doctor.area, doctor.city].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {doctor.years_of_experience && (
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <span>{doctor.years_of_experience} years experience</span>
                  </div>
                )}
                {doctor.gender && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{doctor.gender}</span>
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
              {doctor.description ? (
                <p>{doctor.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description available</p>
              )}
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {doctor.title && (
                  <div>
                    <p className="text-sm text-muted-foreground">Title</p>
                    <p className="font-medium">{doctor.title}</p>
                  </div>
                )}
                {doctor.specialty && (
                  <div>
                    <p className="text-sm text-muted-foreground">Specialty</p>
                    <p className="font-medium">{doctor.specialty}</p>
                  </div>
                )}
                {doctor.years_of_experience && (
                  <div>
                    <p className="text-sm text-muted-foreground">Experience</p>
                    <p className="font-medium">{doctor.years_of_experience} years</p>
                  </div>
                )}
                {doctor.gender && (
                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p className="font-medium capitalize">{doctor.gender}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Practice Locations */}
          <Card>
            <CardHeader>
              <CardTitle>Practice Locations ({doctor.branches?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {doctor.branches?.length > 0 ? (
                <div className="space-y-4">
                  {doctor.branches.map((branch: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        {/* Facility Photo */}
                        {branch.facility_photo_url ? (
                          <Avatar className="h-12 w-12 rounded-lg flex-shrink-0">
                            <AvatarImage src={branch.facility_photo_url} className="rounded-lg object-cover" />
                            <AvatarFallback className="rounded-lg bg-muted">
                              <Building2 className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          {/* Facility Name */}
                          <h3 className="font-semibold">
                            {branch.facility_name || branch.name || `Location ${index + 1}`}
                          </h3>
                          
                          {/* Branch Type */}
                          {branch.branch_type && (
                            <Badge 
                              variant={branch.branch_type === 'private_practice' ? 'default' : 'secondary'} 
                              className="mt-1 text-xs"
                            >
                              {branch.branch_type === 'private_practice' && 'Private Practice'}
                              {branch.branch_type === 'hospital' && 'Hospital'}
                              {branch.branch_type === 'clinic' && 'Medical Center'}
                              {branch.branch_type === 'center' && 'Medical Center'}
                            </Badge>
                          )}
                          
                          {/* Location */}
                          <p className="text-sm text-muted-foreground mt-1">
                            {[branch.area, branch.city].filter(Boolean).join(', ') || 'Location not specified'}
                          </p>
                          
                          {/* Address */}
                          {branch.address && (
                            <p className="text-sm text-muted-foreground mt-1">{branch.address}</p>
                          )}
                          
                          {/* Phone */}
                          {branch.phone_numbers?.length > 0 && (
                            <div className="flex items-center gap-2 mt-2 text-sm">
                              <Phone className="h-3 w-3" />
                              <span>{branch.phone_numbers.join(', ')}</span>
                            </div>
                          )}
                          
                          {/* Consultation Fee */}
                          {branch.consultation_fee && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Consultation Fee: {branch.consultation_fee} EGP
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No practice locations listed</p>
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
              {doctor.phone_number ? (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{doctor.phone_number}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic">No phone number</p>
              )}
              
              <Separator />
              
              {(doctor.city || doctor.area) && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">
                      {[doctor.area, doctor.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}
              
              {firstBranch?.address && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{firstBranch.address}</p>
                    </div>
                  </div>
                </>
              )}

              {doctor.gender && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Gender</p>
                      <p className="font-medium capitalize">{doctor.gender}</p>
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
              {doctor.verification_status === 'verified' ? (
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle className="h-8 w-8" />
                  <div>
                    <p className="font-semibold">Verified Doctor</p>
                    <p className="text-sm">This doctor has been verified by our team</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-amber-600">
                  <Clock className="h-8 w-8" />
                  <div>
                    <p className="font-semibold">Pending Verification</p>
                    <p className="text-sm">This doctor is awaiting verification</p>
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
