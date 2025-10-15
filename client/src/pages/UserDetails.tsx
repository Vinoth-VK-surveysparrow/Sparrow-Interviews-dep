import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, User, Calendar, Image, CheckCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Button, Drawer, DrawerHeader, DrawerBody, DrawerFooter, Heading } from "@sparrowengg/twigs-react";
import { Badge } from '@/components/ui/badge';
import { AdminTable, Column } from '@/components/ui/admin-table';
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
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
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


export default function UserDetails() {
  const [match, params] = useRoute('/admin/user/:userEmail');
  const [, setLocation] = useLocation();
  const [userDetails, setUserDetails] = useState<UserDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleTestColumns, setVisibleTestColumns] = useState<string[]>([]);
  const [testFilter, setTestFilter] = useState("");
  
  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  // Deletion loading states
  const [deletingTest, setDeletingTest] = useState<string | null>(null);
  const [deletingAssessment, setDeletingAssessment] = useState<string | null>(null);
  // Delete confirmation dialogs
  const [deleteTestDialog, setDeleteTestDialog] = useState<{ open: boolean; testId: string; testName: string } | null>(null);
  const [deleteAssessmentDialog, setDeleteAssessmentDialog] = useState<{ open: boolean; assessmentId: string; assessmentName: string } | null>(null);
  const { toast } = useToast();
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
      toast({
        title: "Deleting...",
        description: "Removing test data and associated files...",
      });

      console.log('🔍 UserDetails: Deleting test assessments with Firebase auth');

      // Use authenticated admin API service
      const result = await AuthenticatedAdminApiService.deleteTestAssessments(testId, userEmail);
      console.log('Delete test assessments result:', result);

      toast({
        title: "Test Data Deleted Successfully",
        description: `Removed all assessments and files for test ${testToDelete?.test_id || testId}`,
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

      toast({
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
        const updatedTests = prev.tests.map(test => ({
          ...test,
          completed_assessments: test.completed_assessments?.filter((ass: any) => ass.assessment_id !== assessmentId) || [],
          total_assessments_completed: test.total_assessments_completed - (test.completed_assessments?.find((ass: any) => ass.assessment_id === assessmentId) ? 1 : 0)
        }));
        
        // Also update selectedTest if it's the one being modified
        if (selectedTest && testContainingAssessment && selectedTest.test_id === testContainingAssessment.test_id) {
          const updatedSelectedTest = updatedTests.find(test => test.test_id === selectedTest.test_id);
          setSelectedTest(updatedSelectedTest || null);
        }
        
        return {
          ...prev,
          tests: updatedTests
        };
      });

      // Show loading toast
      toast({
        title: "Deleting...",
        description: "Removing assessment data and associated files...",
      });

      const result = await AuthenticatedAdminApiService.deleteAssessment(userEmail, assessmentId);
      console.log('Delete assessment result:', result);

      toast({
        title: "Assessment Deleted Successfully",
        description: `Removed assessment ${assessmentToDelete?.assessment_name || assessmentId} and associated files`,
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
      
      // Also restore selectedTest if it was being modified
      if (selectedTest && testContainingAssessment && selectedTest.test_id === testContainingAssessment.test_id) {
        setSelectedTest(testContainingAssessment);
      }

      toast({
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

  const handleTestRowClick = (test: any) => {
    setSelectedTest(test);
    setIsDrawerOpen(true);
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

  // Test columns definition
  const allTestColumns: Column[] = [
    {
      key: "test_id",
      label: "Test ID",
      width: "150px"
    },
    {
      key: "status",
      label: "Status",
      width: "100px",
      render: (value) => (
        <Badge className={getStatusColor(value)}>
          {value}
        </Badge>
      )
    },
    {
      key: "started_at",
      label: "Started",
      width: "180px",
      render: (value) => formatDate(value)
    },
    {
      key: "last_updated",
      label: "Last Updated",
      width: "180px",
      render: (value) => formatDate(value)
    },
    {
      key: "total_assessments_completed",
      label: "Completed Assessments",
      width: "150px"
    },
    {
      key: "total_images_uploaded",
      label: "Images Uploaded",
      width: "120px"
    },
    {
      key: "clear_data",
      label: "Clear Data",
      width: "100px",
      render: (value, row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDeleteTest(row.test_id, row.test_id)}
          disabled={deletingTest === row.test_id}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )
    }
  ];

  const allTestColumnKeys = allTestColumns.map(col => col.key);

  // Initialize visible columns
  useEffect(() => {
    setVisibleTestColumns([...allTestColumnKeys]);
  }, []);

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
            variant="solid"
            color="primary"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back
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
            variant="solid"
            color="primary"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back
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
                  variant="solid"
                  color="primary"
                  onClick={handleBack}
                  className="h-10 w-10 p-0"
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
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
        <div className="container my-10 space-y-4 p-4 border border-border rounded-lg bg-background shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Test History
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              All tests attempted by this user
            </p>
          </div>

          <AdminTable
            columns={allTestColumns}
            data={userDetails.tests.filter(test =>
              !testFilter || test.test_id.toLowerCase().includes(testFilter.toLowerCase())
            )}
            visibleColumns={visibleTestColumns}
            onToggleColumn={toggleTestColumn}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            searchValue={testFilter}
            onSearchChange={setTestFilter}
            searchPlaceholder="Filter by test ID..."
            emptyMessage="No tests found for this user."
            onRowClick={handleTestRowClick}
            rowClassName="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          />
        </div>


        {/* Delete Test Confirmation Dialog */}
        <AlertDialog open={deleteTestDialog?.open || false} onOpenChange={(open) => setDeleteTestDialog(open ? deleteTestDialog : null)}>
          <AlertDialogContent className="z-[9999]">
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
          <AlertDialogContent className="z-[9999]">
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

        {/* Assessments Drawer */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        >
          <DrawerHeader className="bg-card border-b border-border">
            <Heading size="h4" className="text-foreground">
              Assessments
            </Heading>
          </DrawerHeader>
          <DrawerBody className="bg-background">
            {selectedTest && selectedTest.completed_assessments.length > 0 ? (
              <div className="space-y-0">
                {selectedTest.completed_assessments.map((assessment: any, index: number) => (
                  <div key={assessment.assessment_id || index}>
                    <div className="py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground">
                          {assessment.assessment_name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-teal-500 text-white">
                            Completed
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAssessment(assessment.assessment_id, assessment.assessment_name)}
                            disabled={deletingAssessment === assessment.assessment_id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong className="text-foreground">Assessment ID:</strong> <span className="text-foreground/80">{assessment.assessment_id}</span></p>
                        <p><strong className="text-foreground">Completed At:</strong> <span className="text-foreground/80">{formatDate(assessment.completed_at)}</span></p>
                        <p><strong className="text-foreground">Images Count:</strong> <span className="text-foreground/80">{assessment.image_count}</span></p>
                      </div>
                    </div>
                    {index < selectedTest.completed_assessments.length - 1 && (
                      <hr className="border-border my-0" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No assessments found for this test.
              </div>
            )}
          </DrawerBody>
          <DrawerFooter className="bg-card border-t border-border">
            <Button
              variant="solid"
              color="primary"
              onClick={() => setIsDrawerOpen(false)}
            >
              Close
            </Button>
          </DrawerFooter>
        </Drawer>
      </div>
    </main>
  );
}
