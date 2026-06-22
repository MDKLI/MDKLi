import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { invitationApi, profileApi } from '@/lib/api'
import { Loader2, Users, MapPin, DollarSign, UserX } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface BranchDoctor {
  id: string
  fullName: string
  email: string
  specialty: string
  title: string
  photoUrl: string
  consultationFee: number
  assignedAt: string
}

interface Branch {
  id: string
  name: string
  city: string
  area: string
  address: string
  doctors: BranchDoctor[]
}

export function BranchDoctorsPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadFacilityProfile()
  }, [])

  const loadFacilityProfile = async () => {
    try {
      const result: any = await profileApi.getProfile()
      const data = result?.data || result?.data?.data
      
      if (data?.id) {
        loadBranchDoctors(data.id)
      }
    } catch (error) {
      toast.error('Failed to load facility profile')
      setIsLoading(false)
    }
  }

  const loadBranchDoctors = async (fid: string) => {
    try {
      // First get facility branches
      const branchesResult: any = await invitationApi.getFacilityBranches(fid)
      if (branchesResult?.data?.data) {
        const branchesData = branchesResult.data.data
        
        // For each branch, get the doctors
        const branchesWithDoctors = await Promise.all(
          branchesData.map(async (branch: any) => {
            try {
              const doctorsResult: any = await invitationApi.getBranchDoctors(branch.id)
              return {
                ...branch,
                doctors: doctorsResult?.data?.data || []
              }
            } catch (error) {
              return {
                ...branch,
                doctors: []
              }
            }
          })
        )
        
        setBranches(branchesWithDoctors)
      }
    } catch (error) {
      toast.error('Failed to load branch doctors')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKickDoctor = async (doctorId: string, branchId: string, branchName: string) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Doctor',
      description: `Are you sure you want to remove this doctor from ${branchName}?`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }))
        setProcessingId(`${doctorId}-${branchId}`)
        try {
          const result: any = await invitationApi.kickDoctorFromBranch(doctorId, branchId)
          if (result?.data) {
            toast.success('Doctor removed from branch')
            // Reload
            const profileResult: any = await profileApi.getProfile()
            const data = profileResult?.data || profileResult?.data?.data
            if (data?.id) {
              loadBranchDoctors(data.id)
            }
          } else {
            toast.error(result?.error || 'Failed to remove doctor')
          }
        } catch (error) {
          toast.error('Failed to remove doctor')
        } finally {
          setProcessingId(null)
        }
      },
    })
  }

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Branch Doctors</h1>
      </div>

      {branches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No branches found
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Add branches to see doctors assigned to them
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {branches.map((branch) => (
            <Card key={branch.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {branch.name}
                  <Badge variant="secondary">
                    {branch.city}, {branch.area}
                  </Badge>
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {branch.doctors.length} doctors
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {branch.doctors.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No doctors assigned to this branch yet.
                    Invite doctors from the Invitations page.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {branch.doctors.map((doctor) => (
                      <div
                        key={doctor.id}
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={doctor.photoUrl} />
                            <AvatarFallback>
                              {doctor.fullName?.charAt(0) || 'D'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">
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
                              {doctor.title && (
                                <Badge variant="outline" className="text-xs">
                                  {doctor.title}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {doctor.consultationFee} EGP
                              </span>
                              <span>
                                Since {formatDate(doctor.assignedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleKickDoctor(doctor.id, branch.id, branch.name)}
                          disabled={processingId === `${doctor.id}-${branch.id}`}
                        >
                          {processingId === `${doctor.id}-${branch.id}` ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <UserX className="h-4 w-4 mr-1" />
                          )}
                          Kick
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        desc={confirmDialog.description}
        confirmText="Remove"
        cancelBtnText="Cancel"
        destructive
        handleConfirm={confirmDialog.onConfirm}
      />
    </div>
  )
}
