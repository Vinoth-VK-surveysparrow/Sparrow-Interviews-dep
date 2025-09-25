import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from '@/components/ui/table';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { AlertCircle, Loader2, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import { S3Service, AllUser } from '@/lib/s3Service';
import { AuthenticatedAdminApiService } from '@/lib/authenticatedApiService';
import { UsersTablePlaceholder } from '@/components/ui/table-placeholder';

export default function AdminUsers() {
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Users table state
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [emailFilter, setEmailFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 15;

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Microsoft Clarity tracking
  const { trackPageView, trackUserAction, setUserId, setTag } = useClarity(true, 'Admin Users');

  // Set user identification for Clarity
  useEffect(() => {
    if (user?.email) {
      setUserId(user.email, user.displayName || undefined);
      setTag('user_type', 'admin');
      setTag('page_type', 'admin_users');
    }
  }, [user?.email, user?.displayName, setUserId, setTag]);

  // Fetch users data
  useEffect(() => {
    const fetchData = async () => {
      // Don't fetch if auth is still loading
      if (authLoading) {
        return;
      }

      // Don't fetch if no user email
      if (!user?.email) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        setLoading(true);

        console.log('🔍 Admin fetching all users with Firebase auth');
        const users = await AuthenticatedAdminApiService.getAllUsers();
        console.log('✅ All users fetched for admin with auth:', users);
        setAllUsers(users);
      } catch (error) {
        console.error('❌ Failed to fetch users:', error);
        setError('Failed to load users. Please try again later.');
        toast({
          title: "Error",
          description: "Failed to load users. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.email, authLoading, toast]);

  // Users data processing
  const sortedUsers = [...allUsers].sort((a, b) => {
    // Handle null/undefined last_active values
    if (!a.last_active && !b.last_active) return 0;
    if (!a.last_active) return sortOrder === 'desc' ? 1 : -1;
    if (!b.last_active) return sortOrder === 'desc' ? -1 : 1;

    const dateA = new Date(a.last_active).getTime();
    const dateB = new Date(b.last_active).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const filteredUsers = sortedUsers.filter(user =>
    user.user_email.toLowerCase().includes(emailFilter.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleUserDetails = (userEmail: string) => {
    trackUserAction('admin_view_user_details', { user_email: userEmail });
    setLocation(`/admin/user/${userEmail}`);
  };

  // Generate user display info
  const getUserDisplayInfo = (email: string) => {
    const name = email.split('@')[0];
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    const initials = displayName.substring(0, 2).toUpperCase();
    const avatarUrl = '/user.png';

    return { displayName, initials, avatarUrl };
  };

  // Format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Refresh data function
  const handleRefresh = async () => {
    if (refreshing) return;

    try {
      setRefreshing(true);
      setError(null);

      console.log('🔄 Refreshing users data with Firebase auth');
      const users = await AuthenticatedAdminApiService.getAllUsers();
      console.log('✅ Users refreshed with auth:', users);
      setAllUsers(users);

      toast({
        title: "Success",
        description: "Users data refreshed successfully",
      });
    } catch (error) {
      console.error('❌ Failed to refresh users:', error);
      setError('Failed to refresh users. Please try again.');
      toast({
        title: "Error",
        description: "Failed to refresh users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Fixed Header - Consistent with main layout */}
          <div className="flex items-center justify-between min-h-[4rem]">
            <div className="flex justify-start">
              {/* Admin panel removed - functionality moved to app sidebar */}
            </div>
          </div>

          <section className="py-8 min-h-[60vh]">
            <div className="container mx-auto px-0 md:px-8">
              <div className="flex gap-4 items-center justify-between mb-6">
                <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <UsersTablePlaceholder />
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Fixed Header - Consistent with main layout */}
          <div className="flex items-center justify-between min-h-[4rem]">
            <div className="flex justify-start">
              {/* Admin panel removed - functionality moved to app sidebar */}
            </div>
          </div>

          <div className="flex items-center justify-center min-h-[40vh]">
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Fixed Header - No layout shifts */}
        <div className="flex items-center justify-between min-h-[4rem]">
          <div className="flex justify-start">
            {/* Admin panel removed - functionality moved to app sidebar */}
          </div>
        </div>

        {/* Users View */}
        <section className="py-8 min-h-[60vh]">
          <div className="container mx-auto px-0 md:px-8">
            {/* Users Controls */}
            <div className="flex gap-4 items-center justify-between mb-6">
              <Input
                placeholder="Filter by email..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="w-64"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Users Table */}
            <div className="border border-border rounded-lg bg-background shadow-sm overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">User</TableHead>
                    <TableHead className="w-[300px]">Email</TableHead>
                    <TableHead className="w-[200px]">
                      <Button
                        variant="ghost"
                        onClick={handleSortToggle}
                        className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
                      >
                        Last Activity
                        {sortOrder === 'desc' ? (
                          <ChevronDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ChevronUp className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.length ? (
                    paginatedUsers.map((userRecord, index) => {
                      const { displayName, initials, avatarUrl } = getUserDisplayInfo(userRecord.user_email);

                      return (
                        <TableRow key={`${userRecord.user_email}-${index}`}>
                           <TableCell className="font-medium">
                             <div className="flex items-center gap-3">
                               <Avatar className="h-8 w-8">
                                 <AvatarImage src={avatarUrl} alt={displayName} />
                                 <AvatarFallback>{initials}</AvatarFallback>
                               </Avatar>
                               <span>{displayName}</span>
                             </div>
                           </TableCell>
                           <TableCell>{userRecord.user_email}</TableCell>
                           <TableCell>{formatDate(userRecord.last_active)}</TableCell>
                           <TableCell>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => handleUserDetails(userRecord.user_email)}
                               className="h-8 w-8 p-0"
                             >
                               <Eye className="h-4 w-4" />
                             </Button>
                           </TableCell>
                         </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    {/* Page numbers */}
                    <div className="flex gap-1">
                      {[...Array(totalPages)].map((_, i) => {
                        const pageNumber = i + 1;
                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {allUsers.length === 0 && !loading && (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6 mx-auto w-24 h-24 flex items-center justify-center">
                <Eye className="h-12 w-12 text-gray-600 dark:text-gray-300" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Users Available
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                No users are currently available in the system.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
