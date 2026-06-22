import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { invitationApi, profileApi } from '@/lib/api'
import { Search, Loader2, UserPlus, MapPin, DollarSign } from 'lucide-react'

interface Doctor {
  id: string
  fullName: string
  email: string
  specialty: string
  yearsOfExperience: string
  photoUrl: string
  title: string
  gender: string
}

interface Branch {
  id: string
  name: string
  city: string
  area: string
  address: string
}

interface SelectedBranch {
  branchId: string
  consultationFee: number
  selected: boolean
}

export function InviteDoctorPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [foundDoctors, setFoundDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [facilityBranches, setFacilityBranches] = useState<Branch[]>([])
  const [selectedBranches, setSelectedBranches] = useState<SelectedBranch[]>([])
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [facilityId, setFacilityId] = useState<string>('')
  const [facilityType, setFacilityType] = useState<string>('')

  // Check if facility type allows invitations
  const canInvite = facilityType === 'hospital' || facilityType === 'center'

  useEffect(() => {
    loadFacilityProfile()
  }, [])

  const loadFacilityProfile = async () => {
    try {
      const result: any = await profileApi.getProfile()
      // Profile data is returned directly (spread), not nested
      const data = result?.data || result?.data?.data
      
      if (data) {
        const fid = data.id || data.user_id
        const ftype = data.facility_type || data.facilityType
        
        setFacilityId(fid)
        setFacilityType(ftype)
        
        // Check permissions
        if (ftype !== 'hospital' && ftype !== 'center') {
          toast.error('Only hospitals and medical centers can invite doctors')
          navigate({ to: '/settings' })
          return
        }
        
        // Load branches
        const branchesResult: any = await invitationApi.getFacilityBranches(fid)
        if (branchesResult?.data?.data) {
          setFacilityBranches(branchesResult.data.data)
        }
      }
    } catch (error) {
      toast.error('Failed to load facility profile')
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    if (!facilityId) {
      toast.error('Facility profile not loaded yet. Please wait...')
      return
    }

    setIsSearching(true)
    try {
      const result: any = await invitationApi.findDoctors(searchQuery, facilityId)
      if (result?.data?.data) {
        setFoundDoctors(result.data.data)
        if (result.data.data.length === 0) {
          toast.info('No doctors found')
        }
      } else if (result?.data) {
        setFoundDoctors(result.data)
        if (result.data.length === 0) {
          toast.info('No doctors found')
        }
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Failed to search doctors')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor)
    setFoundDoctors([])
    setSearchQuery('')
    // Initialize selected branches with empty fees
    setSelectedBranches(
      facilityBranches.map(branch => ({
        branchId: branch.id,
        consultationFee: 0,
        selected: false,
      }))
    )
  }

  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranches(prev =>
      prev.map(sb =>
        sb.branchId === branchId ? { ...sb, selected: !sb.selected } : sb
      )
    )
  }

  const updateConsultationFee = (branchId: string, fee: number) => {
    setSelectedBranches(prev =>
      prev.map(sb =>
        sb.branchId === branchId ? { ...sb, consultationFee: fee } : sb
      )
    )
  }

  const handleSendInvitation = async () => {
    if (!selectedDoctor) {
      toast.error('Please select a doctor')
      return
    }

    const branchesToInvite = selectedBranches.filter(sb => sb.selected && sb.consultationFee > 0)
    if (branchesToInvite.length === 0) {
      toast.error('Please select at least one branch with a consultation fee')
      return
    }

    setIsSending(true)
    try {
      const result: any = await invitationApi.createInvitation({
        doctorId: selectedDoctor.id,
        facilityId,
        branches: branchesToInvite.map(sb => ({
          branchId: sb.branchId,
          consultationFee: sb.consultationFee,
        })),
        message: message || undefined,
      })

      if (result?.data) {
        toast.success('Invitation sent successfully!')
        setSelectedDoctor(null)
        setSelectedBranches([])
        setMessage('')
      } else {
        toast.error(result?.error || 'Failed to send invitation')
      }
    } catch (error) {
      toast.error('Failed to send invitation')
    } finally {
      setIsSending(false)
    }
  }

  const getBranchById = (branchId: string) => {
    return facilityBranches.find(b => b.id === branchId)
  }

  if (!canInvite && facilityType) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Only hospitals and medical centers can invite doctors.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Doctor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search Section */}
          {!selectedDoctor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Search for Doctor</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter doctor email or full name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Search by email or full name
                </p>
              </div>

              {/* Search Results */}
              {foundDoctors.length > 0 && (
                <div className="space-y-3">
                  <Label>Search Results</Label>
                  <div className="grid gap-3">
                    {foundDoctors.map((doctor) => (
                      <Card
                        key={doctor.id}
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleSelectDoctor(doctor)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={doctor.photoUrl} />
                              <AvatarFallback>
                                {doctor.fullName?.charAt(0) || 'D'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">
                                Dr. {doctor.fullName}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {doctor.email}
                              </p>
                              <div className="flex gap-2 mt-1">
                                {doctor.specialty && (
                                  <Badge variant="secondary" className="text-xs">
                                    {doctor.specialty}
                                  </Badge>
                                )}
                                {doctor.yearsOfExperience && (
                                  <Badge variant="outline" className="text-xs">
                                    {doctor.yearsOfExperience} years
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button size="sm">Select</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected Doctor */}
          {selectedDoctor && (
            <div className="space-y-6">
              {/* Doctor Info */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedDoctor.photoUrl} />
                      <AvatarFallback className="text-lg">
                        {selectedDoctor.fullName?.charAt(0) || 'D'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium">
                        Dr. {selectedDoctor.fullName}
                      </h3>
                      <p className="text-muted-foreground">{selectedDoctor.email}</p>
                      <div className="flex gap-2 mt-2">
                        {selectedDoctor.specialty && (
                          <Badge>{selectedDoctor.specialty}</Badge>
                        )}
                        {selectedDoctor.title && (
                          <Badge variant="outline">{selectedDoctor.title}</Badge>
                        )}
                        {selectedDoctor.yearsOfExperience && (
                          <Badge variant="secondary">
                            {selectedDoctor.yearsOfExperience} years experience
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDoctor(null)
                        setSelectedBranches([])
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Branch Selection */}
              <div className="space-y-4">
                <Label>Select Branches & Set Fees</Label>
                <div className="space-y-3">
                  {facilityBranches.map((branch) => {
                    const selectedBranch = selectedBranches.find(
                      (sb) => sb.branchId === branch.id
                    )
                    return (
                      <Card key={branch.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={selectedBranch?.selected || false}
                              onCheckedChange={() => toggleBranchSelection(branch.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {branch.name}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {branch.city}, {branch.area}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {branch.address}
                              </p>
                            </div>
                            {selectedBranch?.selected && (
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  placeholder="Fee"
                                  className="w-24"
                                  value={selectedBranch.consultationFee || ''}
                                  onChange={(e) =>
                                    updateConsultationFee(
                                      branch.id,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                                <span className="text-sm text-muted-foreground">EGP</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Optional Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Message (Optional)</Label>
                <textarea
                  id="message"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Add a personal message to the invitation..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {/* Selected Summary */}
              {selectedBranches.filter((sb) => sb.selected).length > 0 && (
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="font-medium mb-2">Invitation Summary</h4>
                  <ul className="space-y-1 text-sm">
                    {selectedBranches
                      .filter((sb) => sb.selected)
                      .map((sb) => {
                        const branch = getBranchById(sb.branchId)
                        return (
                          <li key={sb.branchId} className="flex justify-between">
                            <span>{branch?.name}</span>
                            <span className="font-medium">{sb.consultationFee} EGP</span>
                          </li>
                        )
                      })}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedDoctor(null)
                    setSelectedBranches([])
                    setMessage('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendInvitation}
                  disabled={
                    isSending ||
                    selectedBranches.filter((sb) => sb.selected && sb.consultationFee > 0)
                      .length === 0
                  }
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
