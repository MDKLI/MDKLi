import { useState } from 'react'
import { Main } from '@/components/layout/main'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, MessageSquare, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

const MOCK_TICKETS = [
  {
    id: 'TKT-001',
    user: { name: 'Ahmed Mohamed', email: 'ahmed@example.com', avatar: '/placeholder-user.jpg' },
    subject: 'Cannot book appointment',
    status: 'open',
    priority: 'high',
    created_at: '2026-07-12T10:00:00Z',
    messages: [
      { sender: 'user', text: 'I keep getting an error when trying to book Dr. Sarah.', time: '10:00 AM' },
    ]
  },
  {
    id: 'TKT-002',
    user: { name: 'Cairo Medical Center', email: 'admin@cairomedical.com', avatar: '/placeholder-user.jpg' },
    subject: 'Update clinic hours',
    status: 'resolved',
    priority: 'low',
    created_at: '2026-07-11T14:30:00Z',
    messages: [
      { sender: 'user', text: 'We need to update our Friday hours.', time: '2:30 PM' },
      { sender: 'admin', text: 'Updated successfully on our end.', time: '3:00 PM' }
    ]
  }
]

export function AdminTickets() {
  const [tickets] = useState(MOCK_TICKETS)
  const [selectedTicket, setSelectedTicket] = useState<typeof MOCK_TICKETS[0] | null>(null)
  const [replyText, setReplyText] = useState('')
  const [search, setSearch] = useState('')

  const handleReply = () => {
    if (!replyText.trim() || !selectedTicket) return
    toast.success('Reply sent (Mock - Backend hook pending)')
    setReplyText('')
    setSelectedTicket(null)
  }

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.user.name.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="destructive">Open</Badge>
      case 'resolved': return <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">Resolved</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Support Tickets</h2>
          <p className="text-muted-foreground">View and respond to user support tickets</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets by subject or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No tickets found.</TableCell></TableRow>
                ) : (
                  filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm">{ticket.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={ticket.user.avatar} />
                            <AvatarFallback>{ticket.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{ticket.user.name}</span>
                            <span className="text-xs text-muted-foreground">{ticket.user.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{ticket.subject}</TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell>
                        <Badge variant={ticket.priority === 'high' ? 'destructive' : 'secondary'} className="capitalize">
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedTicket(ticket)}>
                          <MessageSquare className="mr-2 h-4 w-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTicket?.id} - {selectedTicket?.subject}
              {selectedTicket && getStatusBadge(selectedTicket.status)}
            </DialogTitle>
            <DialogDescription>Conversation with {selectedTicket?.user.name}</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {selectedTicket?.messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.sender === 'admin' ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{msg.sender === 'admin' ? 'AD' : selectedTicket.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className={`flex flex-col gap-1 max-w-[80%] ${msg.sender === 'admin' ? 'items-end' : ''}`}>
                  <div className={`rounded-lg px-4 py-2 text-sm ${msg.sender === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {msg.text}
                  </div>
                  <span className="text-xs text-muted-foreground">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 mt-auto">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your reply here..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex flex-col gap-2">
                <Button onClick={handleReply} disabled={!replyText.trim()}>Send Reply</Button>
                <Button variant="outline" onClick={() => {
                  toast.success('Ticket marked as resolved (Mock)')
                  setSelectedTicket(null)
                }}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Main>
  )
}

