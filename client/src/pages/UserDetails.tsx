import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, User, Calendar, Image, CheckCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCenteredToast } from '@/hooks/use-centered-toast';
import { useClarity } from '@/hooks/useClarity';
import { S3Service, UserDetails as UserDetailsType } from '@/lib/s3Service';
import { AuthenticatedAdminApiService } from '@/lib/authenticatedApiService';
import { TablePlaceholder } from '@/components/ui/table-placeholder';
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

// Define columns for table
const allTestColumns = [
  "Test ID",
  "Status",
  "Started",
  "Last Updated",
  "Completed Assessments",
  "Images Uploaded",
  "Clear Data",
] as const;

const allAssessmentColumns = [
  "Assessment Name",
  "Assessment ID",
  "Test ID",
  "Completed At",
  "Images Count",
  "Clear Data",
] as const;

export default function UserDetails() {
  const [match, params] = useRoute('/admin/user/:userEmail');
  const [, setLocation] = useLocation();
  const [userDetails, setUserDetails] = useState<UserDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleTestColumns, setVisibleTestColumns] = useState<string[]>([...allTestColumns]);
  const [visibleAssessmentColumns, setVisibleAssessmentColumns] = useState<string[]>([...allAssessmentColumns]);
  const [testFilter, setTestFilter] = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("");
  
  // Refresh state
  const [refreshing, setRefreshing] = useState(false);
  // Deletion loading states
  const [deletingTest, setDeletingTest] = useState<string | null>(null);
  const [deletingAssessment, setDeletingAssessment] = useState<string | null>(null);
  // Delete confirmation dialogs
  const [deleteTestDialog, setDeleteTestDialog] = useState<{ open: boolean; testId: string; testName: string } | null>(null);
  const [deleteAssessmentDialog, setDeleteAssessmentDialog] = useState<{ open: boolean; assessmentId: string; assessmentName: string } | null>(null);
  const { toast } = useToast();
  const { toast: centeredToast } = useCenteredToast();
  const { trackUserAction } = useClarity();

  // Extract user email from route parameters
  const userEmail = params?.userEmail || '';

  useEffect(() => {
    if (match && userEmail) {
      fetchUserDetails();
    }
  }, [match, userEmail]);

  const deleteTestAssessments = async (testId: string) => {
    // Store the original test data for potential rollback
    const originalTests = [...userDetails?.tests || []];
    const testToDelete = originalTests.find(test => test.test_id === testId);

    try {

      // Optimistic update: Remove the test from the UI immediately
      setUserDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tests: prev.tests.filter(test => test.test_id !== testId),
          total_tests: prev.total_tests - 1
        };
      });

      // Show loading toast
      centeredToast({
        title: "Deleting...",
        description: "Removing test data and associated files...",
        variant: "loading",
      });

      console.log('🔍 UserDetails: Deleting test assessments with Firebase auth');

      // Use authenticated admin API service
      const result = await AuthenticatedAdminApiService.deleteTestAssessments(testId, userEmail);
      console.log('Delete test assessments result:', result);

      centeredToast({
        title: "Test Data Deleted Successfully",
        description: `Removed all assessments and files for test ${testToDelete?.test_id || testId}`,
        variant: "success",
      });

      // Close the dialog
      setDeleteTestDialog(null);

    } catch (error) {
      console.error('Error deleting test assessments:', error);

      // Rollback: Restore the original test data on failure
      setUserDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tests: originalTests,
          total_tests: originalTests.length
        };
      });

      centeredToast({
        title: "Deletion Failed",
        description: "Failed to delete test assessments. Data has been restored.",
        variant: "destructive",
      });
    } finally {
      setDeletingTest(null);
    }
  };

  const deleteAssessment = async (assessmentId: string) => {
    // Store the original data for potential rollback
    const originalTests = [...userDetails?.tests || []];

    // Find the test containing this assessment and the assessment itself
    let assessmentToDelete: any = null;
    let testContainingAssessment: any = null;

    for (const test of originalTests) {
      const assessment = test.completed_assessments?.find((ass: any) => ass.assessment_id === assessmentId);
      if (assessment) {
        assessmentToDelete = assessment;
        testContainingAssessment = test;
        break;
      }
    }

    try {

      // Optimistic update: Remove the assessment from the UI immediately
      setUserDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tests: prev.tests.map(test => ({
            ...test,
            completed_assessments: test.completed_assessments?.filter((ass: any) => ass.assessment_id !== assessmentId) || [],
            total_assessments_completed: test.total_assessments_completed - (test.completed_assessments?.find((ass: any) => ass.assessment_id === assessmentId) ? 1 : 0)
          }))
        };
      });

      // Show loading toast
      centeredToast({
        title: "Deleting...",
        description: "Removing assessment data and associated files...",
        variant: "loading",
      });

      const adminApiUrl = import.meta.env.VITE_API_ADMIN_URL || 'https://tqqg7hko9g.execute-api.us-west-2.amazonaws.com/api';
      const response = await fetch(`${adminApiUrl}/delete-assessment`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: userEmail,
          assessment_id: assessmentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete assessment');
      }

      const result = await response.json();
      console.log('Delete assessment result:', result);

      centeredToast({
        title: "Assessment Deleted Successfully",
        description: `Removed assessment ${assessmentToDelete?.assessment_name || assessmentId} and associated files`,
        variant: "success",
      });

      // Close the dialog
      setDeleteAssessmentDialog(null);

    } catch (error) {
      console.error('Error deleting assessment:', error);

      // Rollback: Restore the original data on failure
      setUserDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tests: originalTests
        };
      });

      centeredToast({
        title: "Deletion Failed",
        description: "Failed to delete assessment. Data has been restored.",
        variant: "destructive",
      });
    } finally {
      setDeletingAssessment(null);
    }
  };

  const handleDeleteTest = (testId: string, testName: string) => {
    setDeleteTestDialog({ open: true, testId, testName });
  };

  const handleDeleteAssessment = (assessmentId: string, assessmentName: string) => {
    setDeleteAssessmentDialog({ open: true, assessmentId, assessmentName });
  };

  const confirmDeleteTest = async () => {
    if (!deleteTestDialog) return;

    setDeletingTest(deleteTestDialog.testId);
    setDeleteTestDialog(null);
    await deleteTestAssessments(deleteTestDialog.testId);
  };

  const confirmDeleteAssessment = async () => {
    if (!deleteAssessmentDialog) return;

    setDeletingAssessment(deleteAssessmentDialog.assessmentId);
    setDeleteAssessmentDialog(null);
    await deleteAssessment(deleteAssessmentDialog.assessmentId);
  };

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      trackUserAction('admin_view_user_details', { user_email: userEmail });

      const data = await AuthenticatedAdminApiService.getUserDetails(userEmail);
      setUserDetails(data);
    } catch (err) {
      console.error('Error fetching user details:', err);
      setError('Failed to load user details. Please try again.');
      toast({
        title: "Error",
        description: "Failed to load user details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  const toggleTestColumn = (col: string) => {
    setVisibleTestColumns((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    );
  };

  const toggleAssessmentColumn = (col: string) => {
    setVisibleAssessmentColumns((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUserDisplayInfo = (email: string) => {
    const name = email.split('@')[0];
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatarUrl = '/user.png';

    return { displayName, initials, avatarUrl };
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500 text-white';
      case 'started':
        return 'bg-blue-500 text-white';
      case 'in_progress':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Refresh data function
  const handleRefresh = async () => {
    if (refreshing || !userEmail) return;
    
    try {
      setRefreshing(true);
      setError(null);
      
      console.log('🔄 Refreshing user details data for user:', userEmail);
      const response = await AuthenticatedAdminApiService.getUserDetails(userEmail);
      console.log('✅ User details refreshed:', response);
      
      setUserDetails(response);
      
      toast({
        title: "Success",
        description: "User details refreshed successfully",
      });
    } catch (error) {
      console.error('❌ Failed to refresh user details:', error);
      setError('Failed to refresh user details. Please try again.');
      toast({
        title: "Error",
        description: "Failed to refresh user details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (!match) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div>
            <h3 className="font-semibold">Invalid Route</h3>
            <p>The requested user details could not be found.</p>
          </div>
        </Alert>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header Placeholder */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Stats Cards Placeholder */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="border border-border rounded-lg p-6 bg-background shadow-sm">
                <div className="space-y-3">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Table Placeholder */}
          <TablePlaceholder rows={3} columns={5} />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Button 
            variant="outline" 
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <div>
              <h3 className="font-semibold">Error Loading User Details</h3>
              <p>{error}</p>
            </div>
          </Alert>
        </div>
      </main>
    );
  }

  if (!userDetails) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Button 
            variant="outline" 
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="text-center py-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              User Not Found
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              The requested user details could not be found.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { displayName, initials, avatarUrl } = getUserDisplayInfo(userDetails.user_email);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* User Card */}
        <div className="w-full max-w-4xl p-1.5 rounded-2xl relative isolate overflow-hidden bg-white/5 dark:bg-black/90 bg-gradient-to-br from-black/5 to-black/[0.02] dark:from-white/5 dark:to-white/[0.02] backdrop-blur-xl backdrop-saturate-[180%] border border-black/10 dark:border-white/10 shadow-[0_8px_16px_rgb(0_0_0_/_0.15)] dark:shadow-[0_8px_16px_rgb(0_0_0_/_0.25)] will-change-transform translate-z-0">
          <div className="w-full p-5 rounded-xl relative bg-gradient-to-br from-black/[0.05] to-transparent dark:from-white/[0.08] dark:to-transparent backdrop-blur-md backdrop-saturate-150 border border-black/[0.05] dark:border-white/[0.08] text-black/90 dark:text-white shadow-sm will-change-transform translate-z-0 before:absolute before:inset-0 before:bg-gradient-to-br before:from-black/[0.02] before:to-black/[0.01] dark:before:from-white/[0.03] dark:before:to-white/[0.01] before:opacity-0 before:transition-opacity before:pointer-events-none hover:before:opacity-100">
            <div className="flex items-center justify-between">
              {/* Left side - Back button and User info */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex items-center gap-2 h-10 w-10 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 rounded-full overflow-hidden">
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-black dark:text-white/90">
                          {displayName}
                        </span>
                      </div>
                      <span className="text-black dark:text-white/60 text-sm">
                        {userEmail}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side - Stats */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <img src="/Completed Icon 50.png" alt="Completed" className="h-8 w-8" />
                    <div className="text-right">
                      <p className="text-xs text-black dark:text-white/60">Completed</p>
                      <p className="text-lg font-bold text-black dark:text-white/90">
                        {userDetails.tests.reduce((sum, test) => sum + test.total_assessments_completed, 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <img src="/Image Icons 50.png" alt="Images" className="h-8 w-8" />
                    <div className="text-right">
                      <p className="text-xs text-black dark:text-white/60">Images</p>
                      <p className="text-lg font-bold text-black dark:text-white/90">
                        {userDetails.tests.reduce((sum, test) => sum + test.total_images_uploaded, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tests Table */}
        <div className="container my-10 space-y-4 p-4 border border-border rounded-lg bg-background shadow-sm overflow-x-auto">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Test History
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              All tests attempted by this user
            </p>
          </div>

          {/* Filters and Controls */}
          <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Filter by test ID..."
                value={testFilter}
                onChange={(e) => setTestFilter(e.target.value)}
                className="w-48"
              />
            </div>

            <div className="flex gap-2">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  {allTestColumns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col}
                      checked={visibleTestColumns.includes(col)}
                      onCheckedChange={() => toggleTestColumn(col)}
                    >
                      {col}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Table className="w-full">
            <TableHeader>
              <TableRow>
                {visibleTestColumns.includes("Test ID") && <TableHead className="w-[150px]">Test ID</TableHead>}
                {visibleTestColumns.includes("Status") && <TableHead className="w-[100px]">Status</TableHead>}
                {visibleTestColumns.includes("Started") && <TableHead className="w-[180px]">Started</TableHead>}
                {visibleTestColumns.includes("Last Updated") && <TableHead className="w-[180px]">Last Updated</TableHead>}
                {visibleTestColumns.includes("Completed Assessments") && <TableHead className="w-[150px]">Completed Assessments</TableHead>}
                {visibleTestColumns.includes("Images Uploaded") && <TableHead className="w-[120px]">Images Uploaded</TableHead>}
                {visibleTestColumns.includes("Clear Data") && <TableHead className="w-[100px]">Clear Data</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {userDetails.tests.filter(test => 
                !testFilter || test.test_id.toLowerCase().includes(testFilter.toLowerCase())
              ).length ? (
                userDetails.tests.filter(test => 
                  !testFilter || test.test_id.toLowerCase().includes(testFilter.toLowerCase())
                ).map((test, index) => (
                  <TableRow key={`${test.test_id}-${index}`}>
                    {visibleTestColumns.includes("Test ID") && (
                      <TableCell className="font-medium whitespace-nowrap">{test.test_id}</TableCell>
                    )}
                    {visibleTestColumns.includes("Status") && (
                      <TableCell className="whitespace-nowrap">
                        <Badge className={getStatusColor(test.status)}>
                          {test.status}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleTestColumns.includes("Started") && (
                      <TableCell className="whitespace-nowrap">{formatDate(test.started_at)}</TableCell>
                    )}
                    {visibleTestColumns.includes("Last Updated") && (
                      <TableCell className="whitespace-nowrap">{formatDate(test.last_updated)}</TableCell>
                    )}
                    {visibleTestColumns.includes("Completed Assessments") && (
                      <TableCell className="whitespace-nowrap">{test.total_assessments_completed}</TableCell>
                    )}
                    {visibleTestColumns.includes("Images Uploaded") && (
                      <TableCell className="whitespace-nowrap">{test.total_images_uploaded}</TableCell>
                    )}
                    {visibleTestColumns.includes("Clear Data") && (
                      <TableCell className="whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTest(test.test_id, test.test_id)}
                          disabled={deletingTest === test.test_id}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleTestColumns.length} className="text-center py-6">
                    No tests found for this user.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Completed Assessments Details */}
        {userDetails.tests.some(test => test.completed_assessments.length > 0) && (
          <div className="container my-10 space-y-4 p-4 border border-border rounded-lg bg-background shadow-sm overflow-x-auto">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Completed Assessments
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Detailed breakdown of completed assessments
              </p>
            </div>

            {/* Filters and Controls */}
            <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Filter by assessment name..."
                  value={assessmentFilter}
                  onChange={(e) => setAssessmentFilter(e.target.value)}
                  className="w-48"
                />
              </div>

              <div className="flex gap-2">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    {allAssessmentColumns.map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col}
                        checked={visibleAssessmentColumns.includes(col)}
                        onCheckedChange={() => toggleAssessmentColumn(col)}
                      >
                        {col}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  {visibleAssessmentColumns.includes("Assessment Name") && <TableHead className="w-[200px]">Assessment Name</TableHead>}
                  {visibleAssessmentColumns.includes("Assessment ID") && <TableHead className="w-[180px]">Assessment ID</TableHead>}
                  {visibleAssessmentColumns.includes("Test ID") && <TableHead className="w-[150px]">Test ID</TableHead>}
                  {visibleAssessmentColumns.includes("Completed At") && <TableHead className="w-[180px]">Completed At</TableHead>}
                  {visibleAssessmentColumns.includes("Images Count") && <TableHead className="w-[120px]">Images Count</TableHead>}
                  {visibleAssessmentColumns.includes("Clear Data") && <TableHead className="w-[100px]">Clear Data</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const filteredAssessments = userDetails.tests.flatMap(test => 
                    test.completed_assessments.filter(assessment =>
                      !assessmentFilter || assessment.assessment_name.toLowerCase().includes(assessmentFilter.toLowerCase())
                    ).map((assessment, index) => ({ ...assessment, test_id: test.test_id, key: `${assessment.assessment_id}-${index}` }))
                  );

                  return filteredAssessments.length ? (
                    filteredAssessments.map((assessment) => (
                      <TableRow key={assessment.key}>
                        {visibleAssessmentColumns.includes("Assessment Name") && (
                          <TableCell className="font-medium whitespace-nowrap">{assessment.assessment_name}</TableCell>
                        )}
                        {visibleAssessmentColumns.includes("Assessment ID") && (
                          <TableCell className="whitespace-nowrap">{assessment.assessment_id}</TableCell>
                        )}
                        {visibleAssessmentColumns.includes("Test ID") && (
                          <TableCell className="whitespace-nowrap">{assessment.test_id}</TableCell>
                        )}
                        {visibleAssessmentColumns.includes("Completed At") && (
                          <TableCell className="whitespace-nowrap">{formatDate(assessment.completed_at)}</TableCell>
                        )}
                        {visibleAssessmentColumns.includes("Images Count") && (
                          <TableCell className="whitespace-nowrap">{assessment.image_count}</TableCell>
                        )}
                        {visibleAssessmentColumns.includes("Clear Data") && (
                          <TableCell className="whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAssessment(assessment.assessment_id, assessment.assessment_name)}
                              disabled={deletingAssessment === assessment.assessment_id}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={visibleAssessmentColumns.length} className="text-center py-6">
                        No assessments found.
                      </TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Delete Test Confirmation Dialog */}
        <AlertDialog open={deleteTestDialog?.open || false} onOpenChange={(open) => setDeleteTestDialog(open ? deleteTestDialog : null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Test Data</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all data for test "{deleteTestDialog?.testName}"?
                This will remove all assessments, progress data, and associated files from S3 storage.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteTest}
                className="bg-red-600 hover:bg-red-700"
                disabled={deletingTest !== null}
              >
                {deletingTest ? 'Deleting...' : 'Delete Data'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Assessment Confirmation Dialog */}
        <AlertDialog open={deleteAssessmentDialog?.open || false} onOpenChange={(open) => setDeleteAssessmentDialog(open ? deleteAssessmentDialog : null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Assessment Data</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the assessment "{deleteAssessmentDialog?.assessmentName}"?
                This will remove the assessment data and associated files from S3 storage.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteAssessment}
                className="bg-red-600 hover:bg-red-700"
                disabled={deletingAssessment !== null}
              >
                {deletingAssessment ? 'Deleting...' : 'Delete Assessment'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}
