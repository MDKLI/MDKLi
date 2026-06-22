import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'
import { authApi, profileApi } from '@/lib/api'

const ACCESS_TOKEN = 'thisisjustarandomstring'
const REFRESH_TOKEN = 'refreshtoken'

interface AuthUser {
  id: string
  username: string
  email: string
  role: string
  exp?: number
  photoUrl?: string
  fullName?: string
  facilityName?: string
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    refreshToken: string
    setAccessToken: (accessToken: string) => void
    setRefreshToken: (refreshToken: string) => void
    resetAccessToken: () => void
    reset: () => void
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
    register: (userData: any) => Promise<{ success: boolean; error?: string }>
    startRegistration: (userData: any) => Promise<{ success: boolean; error?: string; pendingToken?: string; role?: string }>
    completeRegistration: (onboardingData: any) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    isAuthenticated: () => boolean
    fetchProfile: () => Promise<{ success: boolean; error?: string }>
  }
}

export const useAuthStore = create<AuthState>()((set, get) => {
  // Safely parse cookie values
  const safeJsonParse = (str: string | undefined): string => {
    if (!str || str === 'undefined' || str === 'null') return ''
    try {
      return JSON.parse(str)
    } catch {
      return ''
    }
  }
  
  const cookieToken = getCookie(ACCESS_TOKEN)
  const cookieRefresh = getCookie(REFRESH_TOKEN)
  const initToken = safeJsonParse(cookieToken)
  const initRefresh = safeJsonParse(cookieRefresh)
  
  // Decode token to get user info on init
  let initUser: AuthUser | null = null
  if (initToken) {
    try {
      const payload = JSON.parse(atob(initToken.split('.')[1]))
      initUser = {
        id: payload.userId || 'unknown',
        username: '',
        email: '',
        role: payload.role || 'patient',
      }
    } catch {
      // Invalid token
    }
  }

  return {
    auth: {
      user: initUser,
      
      setUser: (user) =>
        set((state) => ({ ...state, auth: { ...state.auth, user } })),
      
      accessToken: initToken,
      
      refreshToken: initRefresh,
      
      setAccessToken: (accessToken) =>
        set((state) => {
          setCookie(ACCESS_TOKEN, JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      
      setRefreshToken: (refreshToken) =>
        set((state) => {
          setCookie(REFRESH_TOKEN, JSON.stringify(refreshToken))
          return { ...state, auth: { ...state.auth, refreshToken } }
        }),
      
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          removeCookie(REFRESH_TOKEN)
          localStorage.removeItem('user')
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '', refreshToken: '' },
          }
        }),

      login: async (username, password) => {
        console.log('[AUTH] Login called with username:', username)
        const result = await authApi.login(username, password)
        console.log('[AUTH] Login API result:', result)
        
        if (result.error || !result.data) {
          console.log('[AUTH] Login failed:', result.error)
          return { success: false, error: result.error || 'Login failed' }
        }

        // Handle API response format
        const token = result.data.token
        const refreshToken = token
        
        if (!token) {
          console.log('[AUTH] No token in response')
          return { success: false, error: 'Invalid login response' }
        }
        
        console.log('[AUTH] Got token:', token.substring(0, 50) + '...')
        
        // Decode JWT to get user role
        let userRole = 'patient'
        let userId = 'unknown'
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          console.log('[AUTH] Decoded payload:', payload)
          userRole = payload.role || 'patient'
          userId = payload.userId || 'unknown'
          console.log('[AUTH] Extracted role:', userRole, 'userId:', userId)
        } catch (e) {
          console.error('[AUTH] Failed to decode token:', e)
        }
        
        const user: AuthUser = { 
          username, 
          id: userId,
          email: '',
          role: userRole
        }
        
        console.log('[AUTH] Setting user:', user)
        
        // Store tokens
        set((state) => {
          setCookie(ACCESS_TOKEN, JSON.stringify(token))
          setCookie(REFRESH_TOKEN, JSON.stringify(refreshToken))
          localStorage.setItem('user', JSON.stringify(user))
          return {
            ...state,
            auth: {
              ...state.auth,
              user,
              accessToken: token,
              refreshToken,
            },
          }
        })

        console.log('[AUTH] Login complete, user role:', userRole)
        
        // Fetch full profile data to get fullName, photoUrl, etc.
        console.log('[AUTH] Fetching full profile...')
        const profileResult = await get().auth.fetchProfile()
        if (!profileResult.success) {
          console.log('[AUTH] Failed to fetch profile:', profileResult.error)
        } else {
          console.log('[AUTH] Profile fetched successfully')
        }
        
        return { success: true }
      },

      // Old registration (immediate)
      register: async (userData) => {
        const result = await authApi.register(userData)
        
        if (result.error) {
          return { success: false, error: result.error }
        }

        return { success: true }
      },

      // New delayed registration flow
      startRegistration: async (userData: any) => {
        const result = await authApi.startRegistration(userData)
        
        if (result.error || !result.data) {
          return { success: false, error: result.error || 'Registration failed' }
        }

        // Store pending token in localStorage (not cookie - user not logged in yet)
        localStorage.setItem('pendingRegistrationToken', result.data.pendingToken)
        localStorage.setItem('pendingRegistrationRole', result.data.role)
        
        return { 
          success: true, 
          pendingToken: result.data.pendingToken,
          role: result.data.role 
        }
      },

      completeRegistration: async (onboardingData: any) => {
        const pendingToken = localStorage.getItem('pendingRegistrationToken')
        
        if (!pendingToken) {
          return { success: false, error: 'Registration expired. Please start over.' }
        }

        const result = await authApi.completeRegistration(pendingToken, onboardingData)
        
        if (result.error || !result.data) {
          return { success: false, error: result.error || 'Failed to complete registration' }
        }

        // Store the token and user data
        const token = result.data.token
        const refreshToken = token
        
        // Decode JWT to get user info
        let userRole = result.data.role
        let userId = result.data.userId
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          userRole = payload.role || result.data.role
          userId = payload.userId || result.data.userId
        } catch {
          // Use returned values
        }
        
        const user: AuthUser = { 
          username: localStorage.getItem('pendingRegistrationUsername') || '',
          id: userId,
          email: '',
          role: userRole
        }
        
        // Store tokens
        set((state) => {
          setCookie(ACCESS_TOKEN, JSON.stringify(token))
          setCookie(REFRESH_TOKEN, JSON.stringify(refreshToken))
          localStorage.setItem('user', JSON.stringify(user))
          
          // Clear pending registration data
          localStorage.removeItem('pendingRegistrationToken')
          localStorage.removeItem('pendingRegistrationRole')
          localStorage.removeItem('pendingRegistrationUsername')
          localStorage.removeItem('pendingDoctorProfile')
          localStorage.removeItem('pendingPatientProfile')
          localStorage.removeItem('pendingFacilityProfile')
          
          return {
            ...state,
            auth: {
              ...state.auth,
              user,
              accessToken: token,
              refreshToken,
            },
          }
        })

        return { success: true }
      },

      logout: () => {
        get().auth.reset()
      },

      isAuthenticated: () => {
        const state = get()
        return !!state.auth.accessToken && !!state.auth.user
      },

      fetchProfile: async () => {
        try {
          const result = await profileApi.getProfile()
          if (result.error || !result.data) {
            return { success: false, error: result.error || 'Failed to fetch profile' }
          }

          const profileData = result.data as any
          const currentUser = get().auth.user
          
          if (!currentUser) {
            return { success: false, error: 'No user logged in' }
          }

          // Handle snake_case and camelCase fields from backend
          // Try multiple field names to ensure we get the data
          const fullName = profileData.full_name || profileData.fullName || profileData.name || ''
          const facilityName = profileData.clinic_name || profileData.facility_name || profileData.facilityName || profileData.name || ''
          const photoUrl = profileData.photo_url || profileData.photoUrl || profileData.avatar || ''
          const email = profileData.user?.email || profileData.email || currentUser.email
          const username = profileData.username || profileData.user?.username || currentUser.username

          // Update user with profile data
          const updatedUser: AuthUser = {
            ...currentUser,
            email: email,
            photoUrl: photoUrl,
            fullName: fullName,
            facilityName: facilityName,
            username: username,
          }

          // Update store and localStorage
          set((state) => {
            localStorage.setItem('user', JSON.stringify(updatedUser))
            return {
              ...state,
              auth: { ...state.auth, user: updatedUser },
            }
          })

          return { success: true }
        } catch (error) {
          console.error('[AUTH] Error fetching profile:', error)
          return { success: false, error: 'Failed to fetch profile' }
        }
      },
    },
  }
})
