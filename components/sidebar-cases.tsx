'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, FolderOpen, Terminal, Trash2, LogOut } from 'lucide-react';
import { SignOutButton, SignedIn } from '@clerk/nextjs';
import { PricingSheet } from '@/components/pricing-sheet';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Case {
  id: string;
  title: string;
  tags: string[];
  created_at: string;
}

interface SidebarCasesProps {
  cases: Case[];
  onCaseCreated: () => void;
}

export function SidebarCases({ cases, onCaseCreated }: SidebarCasesProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) throw new Error('Failed to create case');

      toast.success('Case created successfully');
      setTitle('');
      setOpen(false);
      onCaseCreated();
    } catch (error) {
      toast.error('Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, caseId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCaseToDelete(caseId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!caseToDelete) return;

    try {
      const response = await fetch(`/api/cases?caseId=${caseToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete case');
      }

      toast.success('Case deleted successfully');

      if (pathname.includes(caseToDelete)) {
        router.push('/app');
      }

      onCaseCreated();
    } catch (error) {
      console.error('Delete case error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete case');
    } finally {
      setDeleteDialogOpen(false);
      setCaseToDelete(null);
    }
  };

  return (
    <div className="w-full lg:w-64 bg-white border-r border-emerald-200 flex flex-col h-[100dvh] lg:h-screen">
      <div className="p-4 border-b border-emerald-200">
        <Link href="/" className="flex items-center space-x-2">
          <Terminal className="h-6 w-6 text-emerald-600" />
          <span className="text-lg font-bold text-emerald-700 font-mono">ARCHIVE.INTEL</span>
        </Link>
        <SignedIn>
          <SignOutButton signOutOptions={{ redirectUrl: '/' }}>
            <button
              type="button"
              className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm font-mono text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all border border-transparent hover:border-emerald-200"
            >
              <LogOut className="h-4 w-4" />
              Exit Session
            </button>
          </SignOutButton>
        </SignedIn>
      </div>

      <div className="p-4 space-y-2">
        <PricingSheet />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-sm shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              NEW.CASE
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-emerald-200">
            <DialogHeader>
              <DialogTitle className="text-emerald-700 font-mono">CREATE.CASE</DialogTitle>
              <DialogDescription className="text-gray-600 font-mono text-sm">
                Initialize new investigation workspace
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCase} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="case-title" className="text-emerald-700 font-mono text-sm">
                  CASE.TITLE
                </Label>
                <Input
                  id="case-title"
                  placeholder="e.g., Social Media Investigation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white border-emerald-200 text-gray-900 placeholder:text-gray-400 font-mono"
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
                disabled={loading || !title.trim()}
              >
                {loading ? 'INITIALIZING...' : 'CREATE.CASE'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-2">
          {cases.length === 0 ? (
            <div className="text-center py-8 text-emerald-600/50 text-xs font-mono">
              NO.CASES
              <br />
              CREATE.ONE.TO.BEGIN
            </div>
          ) : (
            cases.map((caseItem) => {
              const isActive = pathname === `/app/cases/${caseItem.id}`;
              return (
                <div key={caseItem.id} className="relative group">
                  <Link
                    href={`/app/cases/${caseItem.id}`}
                    className={`block p-3 rounded-lg transition-all border ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50 border-transparent hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start space-x-2 min-w-0 flex-1">
                        <FolderOpen className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate font-mono text-sm">{caseItem.title}</div>
                          <div className="text-xs opacity-60 mt-1 font-mono">
                            {new Date(caseItem.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteClick(e, caseItem.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-700 flex-shrink-0"
                        title="Delete case"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white border-emerald-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-700 font-mono">DELETE.CASE</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 font-mono text-sm">
              Are you sure you want to delete this case? This action cannot be undone. All queries and data associated with this case will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono border-emerald-200">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white font-mono"
            >
              DELETE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
