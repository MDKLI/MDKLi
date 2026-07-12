import { useRef } from 'react'
import { FileText, ImagePlus, Mic, Paperclip, Video } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

type MediaType = 'image' | 'video' | 'file' | 'audio'

// Mirrors MEDIA_TYPE_LIMITS in chat-service/src/services/media.service.ts.
// This is UX-only — the server re-checks the real cap regardless of what's declared here.
const TYPE_CONFIG: Record<
  MediaType,
  { label: string; icon: typeof ImagePlus; accept: string; maxMb: number }
> = {
  image: { label: 'Photo', icon: ImagePlus, accept: 'image/*', maxMb: 10 },
  video: { label: 'Video', icon: Video, accept: 'video/*', maxMb: 50 },
  file: { label: 'Document', icon: FileText, accept: '.pdf,.doc,.docx,.txt', maxMb: 20 },
  audio: { label: 'Audio', icon: Mic, accept: 'audio/*', maxMb: 15 },
}

type MediaDropdownProps = {
  disabled?: boolean
  onSelectFile: (file: File, type: MediaType) => void
}

export function MediaDropdown({ disabled, onSelectFile }: MediaDropdownProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingTypeRef = useRef<MediaType | null>(null)

  const handlePick = (type: MediaType) => {
    pendingTypeRef.current = type
    if (inputRef.current) {
      inputRef.current.accept = TYPE_CONFIG[type].accept
      inputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const type = pendingTypeRef.current
    if (!file || !type) return

    const maxBytes = TYPE_CONFIG[type].maxMb * 1024 * 1024
    if (file.size > maxBytes) {
      alert(`${TYPE_CONFIG[type].label} must be under ${TYPE_CONFIG[type].maxMb}MB`)
      e.target.value = ''
      return
    }

    onSelectFile(file, type)
    e.target.value = ''
  }

  return (
    <>
      <input ref={inputRef} type='file' className='hidden' onChange={handleFileChange} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size='icon' type='button' variant='ghost' className='h-8 rounded-md' disabled={disabled}>
            <Paperclip size={20} className='stroke-muted-foreground' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          {(Object.keys(TYPE_CONFIG) as MediaType[]).map((type) => {
            const { label, icon: Icon, maxMb } = TYPE_CONFIG[type]
            return (
              <DropdownMenuItem key={type} onSelect={() => handlePick(type)}>
                <Icon className='me-2 size-4' />
                {label}
                <span className='ms-auto text-xs text-muted-foreground'>{maxMb}MB max</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
