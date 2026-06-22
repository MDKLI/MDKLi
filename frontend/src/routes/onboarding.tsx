import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// Checkbox import removed - not currently used
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import { profileApi } from '@/lib/api'
import { cities, getAreasByCity } from '@/data/cities'
import { specialties } from '@/data/specialties'
import { titles } from '@/data/titles'
import { bloodTypes, genders, facilityTypes, smokingOptions } from '@/data/enums'
import { ChevronLeft, ChevronRight, Plus, Trash2, Stethoscope, Building2, User, Upload, X } from 'lucide-react'
import { format } from 'date-fns'
import { ImageCropper } from '@/components/image-cropper'

export const Route = createFileRoute('/onboarding')({
  component: Onboarding,
})

// Schemas for each step
const patientBasicSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
})

const patientProfileSchema = z.object({
  gender: z.string().min(1, 'Gender is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  bloodType: z.string().optional(),
  isSmoker: z.string().optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  familyHistory: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().optional().or(z.literal('')),
    phone: z.string().regex(/^[0-9+\-\s()]*$/, 'Please enter a valid phone number').optional().or(z.literal('')),
    email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  }),
  bio: z.string().optional(),
})

const doctorProfessionalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  specialty: z.string().min(1, 'Specialty is required'),
  yearsOfExperience: z.string().optional(),
  gender: z.string().min(1, 'Gender is required'),
  bio: z.string().optional(),
})

const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  cityId: z.string().min(1, 'City is required'),
  area: z.string().min(1, 'Area is required'),
  address: z.string().min(1, 'Address is required'),
  googleMapsUrl: z.string().optional(),
  phoneNumbers: z.array(z.string()),
  consultationFee: z.string().optional(),
})

function Onboarding() {
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [branches, setBranches] = useState<any[]>([])
  const [hasPrivatePractice, setHasPrivatePractice] = useState<boolean | null>(null)
  
  // Get role from pending registration (since user is not logged in yet with delayed registration)
  const pendingToken = localStorage.getItem('pendingRegistrationToken')
  const pendingRole = localStorage.getItem('pendingRegistrationRole')
  const userRole = pendingRole || auth.user?.role || ''
  const isPatient = userRole === 'patient'
  const isDoctor = userRole === 'doctor'
  const isFacility = userRole === 'clinic_admin' || userRole === 'pharmacy_admin'
  
  // Redirect if no pending registration and not logged in
  if (!pendingToken && !auth.isAuthenticated()) {
    toast.error('Please start registration first')
    navigate({ to: '/sign-up', replace: true })
    return null
  }

  // Get max steps based on role
  const getMaxSteps = () => {
    if (isPatient) return 2
    if (isDoctor) {
      // If doctor has no private practice, skip branch step
      return hasPrivatePractice === false ? 3 : 4
    }
    if (isFacility) return 3
    return 1
  }

  const maxSteps = getMaxSteps()

  const handleNext = () => {
    if (step < maxSteps) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleComplete = async () => {
    setIsLoading(true)
    try {
      // NEW: Complete registration - this actually creates the user account
      // Collect all onboarding data from localStorage (saved during each step)
      let profileData: any = {}
      
      if (isDoctor) {
        const doctorProfile = JSON.parse(localStorage.getItem('pendingDoctorProfile') || '{}')
        console.log('[ONBOARDING] Doctor profile from localStorage:', doctorProfile)
        profileData = {
          full_name: doctorProfile.fullName,
          photo_url: doctorProfile.photoUrl,
          phone_number: doctorProfile.phoneNumber,
          title: doctorProfile.title,
          specialty: doctorProfile.specialty,
          years_of_experience: doctorProfile.yearsOfExperience,
          gender: doctorProfile.gender,
          description: doctorProfile.bio,
          has_private_practice: doctorProfile.hasPrivatePractice,
        }
        console.log('[ONBOARDING] Mapped profileData:', profileData)
      } else if (isPatient) {
        const patientProfile = JSON.parse(localStorage.getItem('pendingPatientProfile') || '{}')
        profileData = {
          full_name: patientProfile.fullName,
          gender: patientProfile.gender,
          date_of_birth: patientProfile.dateOfBirth,
          blood_type: patientProfile.bloodType,
          is_smoker: patientProfile.isSmoker,
          allergies: patientProfile.allergies,
          current_medications: patientProfile.currentMedications,
          family_history: patientProfile.familyHistory,
          emergency_contact: patientProfile.emergencyContact,
        }
      } else if (isFacility) {
        const facilityProfile = JSON.parse(localStorage.getItem('pendingFacilityProfile') || '{}')
        const pendingRole = localStorage.getItem('pendingRegistrationRole')
        if (pendingRole === 'pharmacy_admin') {
          // Pharmacy uses pharmacy_name and has description
          profileData = {
            pharmacy_name: facilityProfile.facilityName,
            photo_url: facilityProfile.photoUrl,
            phone_numbers: facilityProfile.phoneNumber ? [facilityProfile.phoneNumber] : [],
            facility_type: facilityProfile.facilityType,
            description: facilityProfile.bio,
          }
        } else {
          // Clinic uses clinic_name
          profileData = {
            clinic_name: facilityProfile.facilityName,
            photo_url: facilityProfile.photoUrl,
            phone_numbers: facilityProfile.phoneNumber ? [facilityProfile.phoneNumber] : [],
            facility_type: facilityProfile.facilityType,
            description: facilityProfile.bio,
          }
        }
      }
      
      const onboardingData = {
        onboarding_completed: true,
        has_private_practice: hasPrivatePractice,
        branches: branches,
        ...profileData,
      }
      
      console.log('[ONBOARDING] Sending onboarding data:', JSON.stringify(onboardingData, null, 2))
      
      const result = await auth.completeRegistration(onboardingData)
      
      if (!result.success) {
        toast.error(result.error || 'Failed to complete registration')
        setIsLoading(false)
        return
      }

      toast.success('Registration completed successfully!')
      toast.success('Welcome to MDKLI!')
      navigate({ to: '/dashboard', replace: true })
    } catch (error) {
      toast.error('Failed to complete registration')
      setIsLoading(false)
    }
  }

  const addBranch = (branchData: any) => {
    setBranches([...branches, branchData])
  }

  const removeBranch = (index: number) => {
    setBranches(branches.filter((_, i) => i !== index))
  }

  const getStepTitle = () => {
    if (isPatient) {
      if (step === 1) return 'Account Information'
      if (step === 2) return 'Medical Profile'
    }
    if (isDoctor) {
      if (step === 1) return 'Account Information'
      if (step === 2) return 'Professional Information'
      if (step === 3) return 'Private Practice'
      if (step === 4) return 'Branch Information'
    }
    if (isFacility) {
      if (step === 1) return 'Account Information'
      if (step === 2) return 'Facility Information'
      if (step === 3) return 'Branch Information'
    }
    return 'Complete Profile'
  }

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
              <CardDescription className="mt-2">
                {getStepTitle()} - Step {step} of {maxSteps}
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {isPatient && <User className="h-8 w-8" />}
              {isDoctor && <Stethoscope className="h-8 w-8" />}
              {isFacility && <Building2 className="h-8 w-8" />}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-muted h-2 rounded-full mt-4">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / maxSteps) * 100}%` }}
            />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Step Content */}
          {isPatient && (
            <>
              {step === 1 && <PatientBasicStep onNext={handleNext} />}
              {step === 2 && <PatientMedicalStep onComplete={handleComplete} isLoading={isLoading} />}
            </>
          )}
          
          {isDoctor && (
            <>
              {step === 1 && <DoctorBasicStep onNext={handleNext} />}
              {step === 2 && <DoctorProfessionalStep onNext={handleNext} />}
              {step === 3 && (
                <DoctorPrivatePracticeStep 
                  onNext={handleNext} 
                  onComplete={handleComplete}
                  setHasPrivatePractice={setHasPrivatePractice}
                  isLoading={isLoading}
                />
              )}
              {step === 4 && hasPrivatePractice === true && (
                <BranchesStep 
                  onComplete={handleComplete} 
                  isLoading={isLoading} 
                  branches={branches} 
                  onAddBranch={addBranch} 
                  onRemoveBranch={removeBranch} 
                  isDoctor={isDoctor}
                />
              )}
            </>
          )}
          
          {isFacility && (
            <>
              {step === 1 && <FacilityBasicStep onNext={handleNext} />}
              {step === 2 && <FacilityInfoStep onNext={handleNext} />}
              {step === 3 && <BranchesStep onComplete={handleComplete} isLoading={isLoading} branches={branches} onAddBranch={addBranch} onRemoveBranch={removeBranch} isDoctor={isDoctor} />}
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                onClick={() => {
                  // Clear pending registration and go back to sign up
                  localStorage.removeItem('pendingRegistrationToken')
                  localStorage.removeItem('pendingRegistrationRole')
                  localStorage.removeItem('pendingRegistrationUsername')
                  navigate({ to: '/sign-up', replace: true })
                }}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Sign Up
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Patient Step 1: Basic Info
function PatientBasicStep({ onNext }: { onNext: () => void }) {
  const form = useForm({
    resolver: zodResolver(patientBasicSchema),
    defaultValues: { fullName: '' },
  })

  const onSubmit = async (data: any) => {
    // Store in localStorage temporarily (user doesn't exist yet during onboarding)
    const existingData = JSON.parse(localStorage.getItem('pendingPatientProfile') || '{}')
    localStorage.setItem('pendingPatientProfile', JSON.stringify({
      ...existingData,
      fullName: data.fullName,
    }))
    onNext()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name *</Label>
        <Input id="fullName" {...form.register('fullName')} placeholder="Enter your full name" />
        {form.formState.errors.fullName && (
          <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full">
        Continue
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  )
}

// Patient Step 2: Medical Info
function PatientMedicalStep({ onComplete, isLoading }: { onComplete: () => void, isLoading: boolean }) {
  const form = useForm({
    resolver: zodResolver(patientProfileSchema),
    defaultValues: {
      gender: '',
      dateOfBirth: '',
      bloodType: '',
      isSmoker: '',
      allergies: '',
      currentMedications: '',
      familyHistory: '',
      emergencyContact: { name: '', phone: '', email: '' },
      bio: '',
    },
  })

  const onSubmit = async (data: any) => {
    // Store in localStorage temporarily (user doesn't exist yet during onboarding)
    const existingData = JSON.parse(localStorage.getItem('pendingPatientProfile') || '{}')
    localStorage.setItem('pendingPatientProfile', JSON.stringify({
      ...existingData,
      ...data,
    }))
    onComplete()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Gender *</Label>
          <Controller
            name="gender"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {genders.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.gender && (
            <p className="text-sm text-destructive">{form.formState.errors.gender.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>Date of Birth *</Label>
          <div className="grid grid-cols-3 gap-2">
            {/* Year Dropdown */}
            <Controller
              name="dateOfBirth"
              control={form.control}
              render={({ field }) => {
                const currentYear = new Date().getFullYear()
                const years = Array.from({ length: 120 }, (_, i) => currentYear - i)
                const selectedDate = field.value ? new Date(field.value) : null
                
                return (
                  <>
                    <Select 
                      value={selectedDate?.getFullYear().toString() || ''}
                      onValueChange={(year) => {
                        const currentDate = field.value ? new Date(field.value) : new Date()
                        const newDate = new Date(currentDate)
                        newDate.setFullYear(parseInt(year))
                        field.onChange(format(newDate, 'yyyy-MM-dd'))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={selectedDate ? (selectedDate.getMonth() + 1).toString() : ''}
                      onValueChange={(month) => {
                        const currentDate = field.value ? new Date(field.value) : new Date()
                        const newDate = new Date(currentDate)
                        newDate.setMonth(parseInt(month) - 1)
                        field.onChange(format(newDate, 'yyyy-MM-dd'))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <SelectItem key={month} value={month.toString()}>
                            {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={selectedDate?.getDate().toString() || ''}
                      onValueChange={(day) => {
                        const currentDate = field.value ? new Date(field.value) : new Date()
                        const newDate = new Date(currentDate)
                        newDate.setDate(parseInt(day))
                        field.onChange(format(newDate, 'yyyy-MM-dd'))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )
              }}
            />
          </div>
          {form.formState.errors.dateOfBirth && (
            <p className="text-sm text-destructive">{form.formState.errors.dateOfBirth.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Blood Type</Label>
          <Controller
            name="bloodType"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  {bloodTypes.map(bt => (
                    <SelectItem key={bt.id} value={bt.id}>{bt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Smoking Status</Label>
          <Controller
            name="isSmoker"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Do you smoke?" />
                </SelectTrigger>
                <SelectContent>
                  {smokingOptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies (if any)</Label>
        <Textarea {...form.register('allergies')} placeholder="List any allergies you have" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentMedications">Current Medications</Label>
        <Textarea {...form.register('currentMedications')} placeholder="List your current medications" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="familyHistory">Family Medical History</Label>
        <Textarea {...form.register('familyHistory')} placeholder="Describe your family's medical history" />
      </div>

      <div className="space-y-2">
        <Label>Emergency Contact</Label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input {...form.register('emergencyContact.name')} placeholder="Contact name" />
          </div>
          <div>
            <Input 
              {...form.register('emergencyContact.phone')} 
              placeholder="Contact phone"
              type="tel"
              inputMode="tel"
              pattern="[0-9+\-\s()]*"
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9+\-\s()]/g, '')
                form.setValue('emergencyContact.phone', value, { shouldValidate: true })
              }}
            />
            {form.formState.errors.emergencyContact?.phone && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.emergencyContact.phone.message}</p>
            )}
          </div>
        </div>
        <div>
          <Input 
            type="email"
            {...form.register('emergencyContact.email')} 
            placeholder="Contact email"
          />
          {form.formState.errors.emergencyContact?.email && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.emergencyContact.email.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Completing...' : 'Complete Profile'}
      </Button>
    </form>
  )
}

// Doctor Step 1: Basic Info with optional phone and profile picture
function DoctorBasicStep({ onNext }: { onNext: () => void }) {
  const form = useForm({
    resolver: zodResolver(z.object({
      fullName: z.string().min(2, 'Full name is required'),
      phoneNumber: z.string().optional(),
    })),
    defaultValues: { fullName: '', phoneNumber: '' },
  })
  const [profileImage, setProfileImage] = useState<string>('')
  const [originalImage, setOriginalImage] = useState<string>('')
  const [showCropper, setShowCropper] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      setOriginalImage(reader.result as string)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = (croppedImage: string) => {
    setProfileImage(croppedImage)
    toast.success('Profile picture cropped successfully')
  }

  const onSubmit = async (data: any) => {
    // Store in localStorage temporarily (user doesn't exist yet during onboarding)
    const existingData = JSON.parse(localStorage.getItem('pendingDoctorProfile') || '{}')
    localStorage.setItem('pendingDoctorProfile', JSON.stringify({
      ...existingData,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      photoUrl: profileImage,
    }))
    onNext()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Profile Picture Upload with Cropper */}
      <div className="space-y-2">
        <Label>Profile Picture <span className="text-muted-foreground text-sm">(Optional)</span></Label>
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={profileImage || '/avatars/shadcn.jpg'}
              alt="Profile"
              className="h-24 w-24 rounded-full object-cover border-2 border-muted"
            />
          </div>
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <Button 
              type="button"
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {profileImage ? 'Change Photo' : 'Upload Photo'}
            </Button>
            <p className="text-xs text-muted-foreground">
              JPG, PNG or GIF. Max 5MB. You can crop after upload.
            </p>
          </div>
        </div>
      </div>

      <ImageCropper
        imageSrc={originalImage}
        isOpen={showCropper}
        onClose={() => setShowCropper(false)}
        onCropComplete={handleCropComplete}
      />

      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name *</Label>
        <Input id="fullName" {...form.register('fullName')} placeholder="Enter your full name" />
        {form.formState.errors.fullName && (
          <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number <span className="text-muted-foreground text-sm">(Optional)</span></Label>
        <Controller
          name="phoneNumber"
          control={form.control}
          render={({ field }) => (
            <Input 
              id="phoneNumber" 
              {...field} 
              placeholder="Enter your phone number"
              type="tel"
              inputMode="tel"
              onChange={(e) => {
                // Only allow numbers, +, -, space, (, )
                const value = e.target.value.replace(/[^0-9+\-\s()]/g, '')
                field.onChange(value)
              }}
            />
          )}
        />
      </div>

      <Button type="submit" className="w-full">
        Continue
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  )
}

// Doctor Step 2: Professional Info
function DoctorProfessionalStep({ onNext }: { onNext: () => void }) {
  const form = useForm({
    resolver: zodResolver(doctorProfessionalSchema),
    defaultValues: {
      title: '',
      specialty: '',
      yearsOfExperience: '',
      gender: '',
      bio: '',
    },
  })

  const onSubmit = async (data: any) => {
    try {
      // Store in localStorage temporarily (user doesn't exist yet during onboarding)
      const existingData = JSON.parse(localStorage.getItem('pendingDoctorProfile') || '{}')
      const newData = {
        ...existingData,
        title: data.title,
        specialty: data.specialty,
        yearsOfExperience: data.yearsOfExperience,
        gender: data.gender,
        bio: data.bio,
      }
      localStorage.setItem('pendingDoctorProfile', JSON.stringify(newData))
      console.log('[DoctorProfessionalStep] Saved to localStorage:', newData)
      onNext()
    } catch (error) {
      console.error('[DoctorProfessionalStep] Error saving to localStorage:', error)
      toast.error('Failed to save professional information')
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Title *</Label>
          <Controller
            name="title"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select title" />
                </SelectTrigger>
                <SelectContent>
                  {titles.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.title && (
            <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>Specialty *</Label>
          <Controller
            name="specialty"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.specialty && (
            <p className="text-sm text-destructive">{form.formState.errors.specialty.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="yearsOfExperience">Years of Experience</Label>
          <Input type="number" {...form.register('yearsOfExperience')} placeholder="Years of experience" />
        </div>
        
        <div className="space-y-2">
          <Label>Gender *</Label>
          <Controller
            name="gender"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {genders.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.gender && (
            <p className="text-sm text-destructive">{form.formState.errors.gender.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea {...form.register('bio')} placeholder="Tell us about your professional background" />
      </div>

      <Button type="submit" className="w-full">
        Continue
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  )
}

// Doctor Step 3: Private Practice
function DoctorPrivatePracticeStep({ 
  onNext, 
  onComplete, 
  setHasPrivatePractice,
  isLoading 
}: { 
  onNext: () => void 
  onComplete: () => void
  setHasPrivatePractice: (value: boolean) => void
  isLoading: boolean
}) {
  const [hasPractice, setHasPracticeLocal] = useState<string>('no')

  const onSubmit = async () => {
    const hasPracticeBool = hasPractice === 'yes'
    setHasPrivatePractice(hasPracticeBool)
    
    // Store in localStorage temporarily
    const existingData = JSON.parse(localStorage.getItem('pendingDoctorProfile') || '{}')
    localStorage.setItem('pendingDoctorProfile', JSON.stringify({
      ...existingData,
      hasPrivatePractice: hasPracticeBool,
    }))
    
    if (hasPracticeBool) {
      // User has private practice, go to branch creation
      onNext()
    } else {
      // User doesn't have private practice, complete onboarding
      onComplete()
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Do you have a private clinic?</h3>
        <p className="text-muted-foreground">If yes, we'll help you set it up. If no, you can receive invitations from hospitals and centers later.</p>
      </div>

      <RadioGroup value={hasPractice} onValueChange={setHasPracticeLocal} className="flex flex-col gap-4">
        <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-muted">
          <RadioGroupItem value="yes" id="yes" />
          <Label htmlFor="yes" className="cursor-pointer">Yes, I have a private practice</Label>
        </div>
        <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-muted">
          <RadioGroupItem value="no" id="no" />
          <Label htmlFor="no" className="cursor-pointer">No, I don't have a private practice</Label>
        </div>
      </RadioGroup>

      <Button onClick={onSubmit} className="w-full" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Continue'}
        {!isLoading && <ChevronRight className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  )
}

// Facility Step 1: Facility Info with logo upload
function FacilityBasicStep({ onNext }: { onNext: () => void }) {
  const form = useForm({
    resolver: zodResolver(z.object({
      facilityName: z.string().min(2, 'Facility name is required'),
      phoneNumber: z.string().optional(),
    })),
    defaultValues: { facilityName: '', phoneNumber: '' },
  })
  const [logoImage, setLogoImage] = useState<string>('')
  const [originalImage, setOriginalImage] = useState<string>('')
  const [showCropper, setShowCropper] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      setOriginalImage(reader.result as string)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = (croppedImage: string) => {
    setLogoImage(croppedImage)
    toast.success('Logo cropped successfully')
  }

  const onSubmit = async (data: any) => {
    // Store in localStorage temporarily (user doesn't exist yet during onboarding)
    const existingData = JSON.parse(localStorage.getItem('pendingFacilityProfile') || '{}')
    localStorage.setItem('pendingFacilityProfile', JSON.stringify({
      ...existingData,
      facilityName: data.facilityName,
      phoneNumber: data.phoneNumber,
      photoUrl: logoImage,
    }))
    onNext()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Facility Logo Upload with Cropper */}
       <div className="space-y-2">
         <Label>Facility Logo <span className="text-muted-foreground text-sm">(Optional)</span></Label>
         <div className="flex items-center gap-4">
           <div className="relative">
             {logoImage ? (
               <img
                 src={logoImage}
                 alt="Facility Logo"
                 className="h-24 w-24 rounded-lg object-contain border-2 border-muted bg-white p-2"
               />
             ) : (
               <div className="h-24 w-24 rounded-lg border-2 border-dashed border-muted bg-muted/50 flex items-center justify-center">
                 <span className="text-xs text-muted-foreground text-center">No Logo</span>
               </div>
             )}
           </div>
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <Button 
              type="button"
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {logoImage ? 'Change Logo' : 'Upload Logo'}
            </Button>
            <p className="text-xs text-muted-foreground">
              JPG, PNG or GIF. Max 5MB. You can crop after upload.
            </p>
          </div>
        </div>
      </div>

      <ImageCropper
        imageSrc={originalImage}
        isOpen={showCropper}
        onClose={() => setShowCropper(false)}
        onCropComplete={handleCropComplete}
      />

      <div className="space-y-2">
        <Label htmlFor="facilityName">Facility Name *</Label>
        <Input id="facilityName" {...form.register('facilityName')} placeholder="Enter facility name" />
        {form.formState.errors.facilityName && (
          <p className="text-sm text-destructive">{form.formState.errors.facilityName.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number <span className="text-muted-foreground text-sm">(Optional)</span></Label>
        <Controller
          name="phoneNumber"
          control={form.control}
          render={({ field }) => (
            <Input 
              id="phoneNumber" 
              {...field} 
              placeholder="Enter facility phone number"
              type="tel"
              inputMode="tel"
              onChange={(e) => {
                // Only allow numbers, +, -, space, (, )
                const value = e.target.value.replace(/[^0-9+\-\s()]/g, '')
                field.onChange(value)
              }}
            />
          )}
        />
      </div>

      <Button type="submit" className="w-full">
        Continue
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  )
}

// Facility Step 2: Facility Type & Bio
function FacilityInfoStep({ onNext }: { onNext: () => void }) {
  const form = useForm({
    resolver: zodResolver(z.object({
      facilityType: z.enum(['hospital', 'center', 'pharmacy']),
      bio: z.string().optional(),
    })),
    defaultValues: {
      facilityType: 'hospital',
      bio: '',
    },
  })

  const onSubmit = async (data: any) => {
    // Store in localStorage temporarily (user doesn't exist yet during onboarding)
    const existingData = JSON.parse(localStorage.getItem('pendingFacilityProfile') || '{}')
    localStorage.setItem('pendingFacilityProfile', JSON.stringify({
      ...existingData,
      ...data,
    }))
    onNext()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Facility Type *</Label>
        <Controller
          name="facilityType"
          control={form.control}
          render={({ field }) => (
            <RadioGroup 
              onValueChange={field.onChange} 
              value={field.value}
              className="flex flex-col gap-2"
            >
              {facilityTypes.map(type => (
                <div key={type.id} className="flex items-center space-x-2 border p-3 rounded-lg cursor-pointer hover:bg-muted">
                  <RadioGroupItem value={type.id} id={type.id} />
                  <Label htmlFor={type.id} className="cursor-pointer">{type.name}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
        {form.formState.errors.facilityType && (
          <p className="text-sm text-destructive">{form.formState.errors.facilityType.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio / Description</Label>
        <Textarea {...form.register('bio')} placeholder="Describe your facility" />
      </div>

      <Button type="submit" className="w-full">
        Continue
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  )
}

// Branch Management (shared between doctor and facility)
function BranchesStep({ 
  onComplete, 
  isLoading, 
  branches, 
  onAddBranch, 
  onRemoveBranch,
  isDoctor
}: { 
  onComplete: () => void, 
  isLoading: boolean,
  branches: any[],
  isDoctor: boolean,
  onAddBranch: (branch: any) => void,
  onRemoveBranch: (index: number) => void,
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedCity, setSelectedCity] = useState('')
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([''])
  const [branchMedia, setBranchMedia] = useState<string[]>([])

  const form = useForm({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: '',
      cityId: '',
      area: '',
      address: '',
      googleMapsUrl: '',
      phoneNumbers: [''],
      consultationFee: '',
    },
  })

  // Reset form when showing add form
  const handleShowAddForm = () => {
    form.reset({
      name: '',
      cityId: '',
      area: '',
      address: '',
      googleMapsUrl: '',
      phoneNumbers: [''],
      consultationFee: '',
    })
    setSelectedCity('')
    setPhoneNumbers([''])
    setBranchMedia([])
    setShowAddForm(true)
  }

  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId)
    form.setValue('cityId', cityId)
    form.setValue('area', '') // Reset area when city changes
  }

  const addPhoneNumber = () => {
    setPhoneNumbers([...phoneNumbers, ''])
  }

  const updatePhoneNumber = (index: number, value: string) => {
    const newPhoneNumbers = [...phoneNumbers]
    newPhoneNumbers[index] = value
    setPhoneNumbers(newPhoneNumbers)
  }

  const removePhoneNumber = (index: number) => {
    if (phoneNumbers.length > 1) {
      setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index))
    }
  }

  const onSubmitBranch = (data: any) => {
    const validPhoneNumbers = phoneNumbers.filter(p => p && p.trim() !== '')
    if (validPhoneNumbers.length === 0) {
      toast.error('Please add at least one phone number')
      return
    }
    
    onAddBranch({
      ...data,
      phoneNumbers: validPhoneNumbers,
      mediaUrls: branchMedia,
    })
    setShowAddForm(false)
    // Reset after successful add
    form.reset()
    setPhoneNumbers([''])
    setSelectedCity('')
    setBranchMedia([])
  }

  const handleComplete = async () => {
    if (branches.length === 0) {
      toast.error('Please add at least one branch')
      return
    }
    
    // Save branches to profile
    await profileApi.updateProfile({
      branches: branches,
    })
    onComplete()
  }

  const handleCancel = () => {
    setShowAddForm(false)
    form.reset()
    setPhoneNumbers([''])
    setSelectedCity('')
    setBranchMedia([])
  }

  // Compress image to reduce size
  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          // Calculate new dimensions
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
          
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }
          
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convert to base64 with compression
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality)
          resolve(compressedBase64)
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const MAX_BRANCH_MEDIA = 10

  const handleBranchMediaSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    // Check if adding these files would exceed the limit
    if (branchMedia.length + files.length > MAX_BRANCH_MEDIA) {
      toast.error(`You can only upload up to ${MAX_BRANCH_MEDIA} photos per branch`)
      return
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`)
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`)
        continue
      }
      
      try {
        // Compress image before storing
        const compressedImage = await compressImage(file, 800, 0.7)
        setBranchMedia(prev => [...prev, compressedImage])
      } catch (error) {
        toast.error(`Failed to process ${file.name}`)
      }
    }
  }

  const removeBranchMedia = (index: number) => {
    setBranchMedia(prev => prev.filter((_, i) => i !== index))
  }

  const areas = selectedCity ? getAreasByCity(selectedCity) : []

  return (
    <div className="space-y-4">
      {!showAddForm ? (
        <>
          {branches.length > 0 && (
            <div className="space-y-2">
              {branches.map((branch, index) => (
                <div key={index} className="flex items-center justify-between border p-3 rounded-lg">
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-sm text-muted-foreground">{cities.find(c => c.id === branch.cityId)?.name} - {branch.area}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onRemoveBranch(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={handleShowAddForm}>
            <Plus className="mr-2 h-4 w-4" />
            Add Branch
          </Button>

          {branches.length > 0 && (
            <Button 
              className="w-full" 
              onClick={handleComplete}
              disabled={isLoading}
            >
              {isLoading ? 'Completing...' : 'Complete Profile'}
            </Button>
          )}
        </>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmitBranch)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Branch Name *</Label>
            <Input {...form.register('name')} placeholder="Enter branch name" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Select onValueChange={handleCityChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Area *</Label>
              <Controller
                name="area"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCity}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedCity ? "Select area" : "Select city first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.area && (
                <p className="text-sm text-destructive">{form.formState.errors.area.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea {...form.register('address')} placeholder="Enter full address" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleMapsUrl">Google Maps URL</Label>
            <Input {...form.register('googleMapsUrl')} placeholder="Paste Google Maps link" />
            <p className="text-xs text-muted-foreground">Latitude and longitude will be extracted automatically</p>
          </div>

          <div className="space-y-2">
            <Label>Phone Numbers</Label>
            {phoneNumbers.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <Input 
                  value={phone}
                  onChange={(e) => {
                    // Only allow numbers, +, -, space, (, )
                    const value = e.target.value.replace(/[^0-9+\-\s()]/g, '')
                    updatePhoneNumber(index, value)
                  }}
                  placeholder="Enter phone number"
                  type="tel"
                  inputMode="tel"
                />
                {phoneNumbers.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePhoneNumber(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addPhoneNumber}>
              <Plus className="mr-2 h-4 w-4" />
              Add another phone
            </Button>
          </div>

          {/* Consultation Fee - Only for doctors */}
          {isDoctor && (
            <div className="space-y-2">
              <Label htmlFor="consultationFee">Consultation Fee</Label>
              <Input {...form.register('consultationFee')} placeholder="e.g., 300 EGP" />
              <p className="text-xs text-muted-foreground">
                Set your consultation fee for this branch
              </p>
            </div>
          )}

          {/* Branch Media Upload */}
          <div className="space-y-2">
            <Label>Branch Photos <span className="text-muted-foreground text-sm">(Optional)</span></Label>
            <div className="space-y-3">
              {branchMedia.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {branchMedia.map((url, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={url}
                        alt={`Branch photo ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removeBranchMedia(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBranchMediaSelect}
                  className="hidden"
                  id="branch-media-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('branch-media-input')?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Photos
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  You can upload up to 10 photos. Max 5MB each.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Branch
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
