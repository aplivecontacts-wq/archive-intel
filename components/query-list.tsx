'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
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
import { Globe, User, Quote, Loader2, FileText, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Query {
  id: string;
  case_id: string;
  raw_input: string;
  normalized_input: string;
  input_type: 'url' | 'username' | 'quote';
  status: 'running' | 'complete';
  created_at: string;
}

interface QueryListProps {
  queries: Query[];
  selectedQueryId?: string;
  onSelectQuery: (queryId: string) => void;
  onQueryDeleted?: () => void;
}

export function QueryList({ queries, selectedQueryId, onSelectQuery, onQueryDeleted }: QueryListProps) {
  const [notesMap, setNotesMap] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);

  const fetchAllNotes = useCallback(async () => {
    try {
      const noteChecks = await Promise.all(
        queries.map(async (query) => {
          const response = await fetch(`/api/notes?queryId=${query.id}`);
          if (response.ok) {
            const data = await response.json();
            const notes = data.notes || [];
            return {
              queryId: query.id,
              hasNote: notes.some((n: { content?: string }) => (n.content || '').trim().length > 0),
            };
          }
          return { queryId: query.id, hasNote: false };
        })
      );

      const map: Record<string, boolean> = {};
      noteChecks.forEach(({ queryId, hasNote }) => {
        map[queryId] = hasNote;
      });
      setNotesMap(map);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  }, [queries]);

  useEffect(() => {
    fetchAllNotes();
  }, [fetchAllNotes]);

  const handleDeleteClick = (e: React.MouseEvent, queryId: string) => {
    e.stopPropagation();
    setQueryToDelete(queryId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!queryToDelete) return;

    try {
      const response = await fetch(`/api/queries?queryId=${queryToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete query');
      }

      toast.success('Query deleted successfully');

      if (onQueryDeleted) {
        onQueryDeleted();
      }
    } catch (error) {
      console.error('Delete query error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete query');
    } finally {
      setDeleteDialogOpen(false);
      setQueryToDelete(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Globe className="h-3 w-3" />;
      case 'username':
        return <User className="h-3 w-3" />;
      default:
        return <Quote className="h-3 w-3" />;
    }
  };

  if (queries.length === 0) {
    return (
      <div className="text-center py-8 text-emerald-600/50 text-xs font-mono">
        NO.QUERIES.YET
        <br />
        RUN.A.SEARCH.TO.BEGIN
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[600px]">
        <div className="space-y-2">
          {queries.map((query) => {
            const isActive = selectedQueryId === query.id;
            const hasNote = notesMap[query.id];

            return (
              <div key={query.id} className="relative group">
                <button
                  onClick={() => onSelectQuery(query.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                      : 'bg-white border-emerald-200 hover:border-emerald-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-xs flex-shrink-0"
                      >
                        {getIcon(query.input_type)}
                        <span className="ml-1 uppercase">{query.input_type}</span>
                      </Badge>
                      {query.status === 'running' && (
                        <Loader2 className="h-3 w-3 animate-spin text-emerald-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {hasNote && (
                        <FileText className="h-4 w-4 text-emerald-600" />
                      )}
                      <button
                        onClick={(e) => handleDeleteClick(e, query.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-700"
                        title="Delete query"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-900 font-mono truncate mb-1">
                    {query.raw_input}
                  </p>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-mono">
                      {formatDistanceToNow(new Date(query.created_at), { addSuffix: true }).toUpperCase()}
                    </p>
                    {query.status === 'running' && (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-xs"
                      >
                        RUNNING
                      </Badge>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white border-emerald-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-700 font-mono">DELETE.QUERY</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 font-mono text-sm">
              Are you sure you want to delete this query? This action cannot be undone. All results and notes associated with this query will be permanently deleted.
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
    </>
  );
}
