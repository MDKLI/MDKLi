import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, UserPlus, User, Stethoscope, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { IconFacebook, IconGithub } from '@/assets/brand-icons'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const formSchema = z
  .object({
    email: z.string().email('Please enter a valid email.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

export function SignUpForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [showRoleSelection, setShowRoleSelection] = useState(true)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    if (!selectedRole) {
      toast.error('Please select your role')
      return
    }

    setIsLoading(true)

    try {
      // Use email prefix as username since backend requires it
      const username = data.email.split('@')[0]
      
      // Map frontend roles to backend roles
      let roleToSend: string
      let profileData: any = {}
      
      if (selectedRole === 'facility') {
        roleToSend = 'clinic_admin'
        profileData = { status: 'pending' }
      } else if (selectedRole === 'pharmacy') {
        roleToSend = 'pharmacy_admin'
        profileData = { status: 'pending' }
      } else if (selectedRole === 'doctor') {
        roleToSend = 'doctor'
        profileData = {}
      } else {
        // Patient
        roleToSend = 'patient'
        profileData = {}
      }
      
      // NEW: Use delayed registration - account is NOT created yet
      const result = await auth.startRegistration({
        username: username,
        email: data.email,
        password: data.password,
        role: roleToSend,
        profileData: profileData,
      })

      if (!result.success) {
        toast.error(result.error || 'Registration failed')
        setIsLoading(false)
        return
      }

      // Store username for later use during completion
      localStorage.setItem('pendingRegistrationUsername', username)
      
      toast.success(`Registration started for ${data.email}!`)
      toast.info('Please complete your profile to finish registration.')
      
      // Redirect to onboarding to complete profile
      // Account will be created only after successful onboarding
      navigate({ to: '/onboarding', replace: true })
      
    } catch (error) {
      toast.error('An error occurred during registration')
      setIsLoading(false)
    }
  }

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role)
    setShowRoleSelection(false)
  }

  if (showRoleSelection) {
    return (
      <div className='space-y-6'>
        <div className='text-center space-y-2'>
          <h2 className='text-xl font-bold'>Who are you?</h2>
          <p className='text-muted-foreground text-sm'>Select your role to get started</p>
        </div>
        
        <RadioGroup
          value={selectedRole}
          onValueChange={handleRoleSelect}
          className='grid grid-cols-1 gap-4'
        >
          <div>
            <RadioGroupItem value='patient' id='patient' className='peer sr-only' />
            <Label
              htmlFor='patient'
              className='flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all'
            >
              <User className='h-8 w-8 text-primary' />
              <div>
                <span className='font-semibold block'>Patient</span>
                <span className='text-sm text-muted-foreground'>
                  Book appointments and manage your health
                </span>
              </div>
            </Label>
          </div>
          
          <div>
            <RadioGroupItem value='doctor' id='doctor' className='peer sr-only' />
            <Label
              htmlFor='doctor'
              className='flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all'
            >
              <Stethoscope className='h-8 w-8 text-primary' />
              <div>
                <span className='font-semibold block'>Doctor</span>
                <span className='text-sm text-muted-foreground'>
                  Manage your practice and patients
                </span>
              </div>
            </Label>
          </div>
          
          <div>
            <RadioGroupItem value='facility' id='facility' className='peer sr-only' />
            <Label
              htmlFor='facility'
              className='flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all'
            >
              <Building2 className='h-8 w-8 text-primary' />
              <div>
                <span className='font-semibold block'>Medical Facility</span>
                <span className='text-sm text-muted-foreground'>
                  Hospital, Clinic, Medical Center, or Pharmacy
                </span>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <div className='flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg'>
          {selectedRole === 'patient' && <User className='h-5 w-5' />}
          {selectedRole === 'doctor' && <Stethoscope className='h-5 w-5' />}
          {selectedRole === 'facility' && <Building2 className='h-5 w-5' />}
          <span className='capitalize font-medium'>{selectedRole}</span>
          <Button 
            type='button'
            variant='ghost' 
            size='sm' 
            className='ml-auto'
            onClick={() => setShowRoleSelection(true)}
          >
            Change
          </Button>
        </div>

        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <UserPlus />}
          Create Account
        </Button>

        <div className='relative my-2'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background px-2 text-muted-foreground'>
              Or continue with
            </span>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <Button
            variant='outline'
            className='w-full'
            type='button'
            disabled={isLoading}
          >
            <IconGithub className='h-4 w-4' /> GitHub
          </Button>
          <Button
            variant='outline'
            className='w-full'
            type='button'
            disabled={isLoading}
          >
            <IconFacebook className='h-4 w-4' /> Facebook
          </Button>
        </div>
      </form>
    </Form>
  )
}
