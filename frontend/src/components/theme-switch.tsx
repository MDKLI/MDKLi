// src/components/theme-switch.tsx
import { useEffect } from 'react'
import { Check, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const themeColor = theme === 'dark' ? '#020817' : '#fff'
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [theme])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip='Toggle theme'>
              <span className='relative flex size-4 shrink-0 items-center justify-center'>
                <Sun className='size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
                <Moon className='absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
              </span>
              <span>Theme</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side='right' align='start' sideOffset={4}>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              Light
              <Check size={14} className={cn('ms-auto', theme !== 'light' && 'hidden')} />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              Dark
              <Check size={14} className={cn('ms-auto', theme !== 'dark' && 'hidden')} />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              System
              <Check size={14} className={cn('ms-auto', theme !== 'system' && 'hidden')} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
