import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { API_ENDPOINTS } from '@/config/api';
import { Button } from "@sparrowengg/twigs-react";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Check, Clock, Edit, X, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import { AuthenticatedAdminApiService } from '@/lib/authenticatedApiService';
import { AIInputWithLoading } from '@/components/ui/ai-input-with-loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar-rac';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { parseDate, today, getLocalTimeZone } from '@internationalized/date';
import { Switch } from '@/components/ui/switch';

interface Test {
  test_id: string;
  test_name: string;
}

interface User {
  user_email: string;
  start_time: string;
  end_time: string;
  email_notification?: boolean;
  call_notification?: boolean;
}

export default function UserAccess() {
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [userQuery, setUserQuery] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [structuredUsers, setStructuredUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ email: '', start_time: '', end_time: '', email_notification: false, call_notification: false });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserStartDate, setNewUserStartDate] = useState<Date | undefined>();
  const [newUserEndDate, setNewUserEndDate] = useState<Date | undefined>();
  const [newUserEmailNotification, setNewUserEmailNotification] = useState(false);
  const [newUserCallNotification, setNewUserCallNotification] = useState(false);

  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { trackUserAction } = useClarity(true, 'User Access');

  // Helper functions to convert between Date and internationalized date
  const dateToInternationalized = (date: Date) => {
    if (!date || isNaN(date.getTime())) return undefined;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return parseDate(`${year}-${month}-${day}`);
  };

  const internationalizedToDate = (intlDate: any) => {
    if (!intlDate) return undefined;
    return new Date(intlDate.year, intlDate.month - 1, intlDate.day);
  };

  // Safe date formatting function
  const safeFormatDate = (date: Date | undefined, formatString: string) => {
    if (!date || isNaN(date.getTime())) return "Invalid date";
    try {
      return format(date, formatString);
    } catch (error) {
      console.error('Date formatting error:', error);
      return "Invalid date";
    }
  };

  // Convert Date to IST format string (treating input as local IST time)
  const toISTString = (date: Date) => {
    if (!date || isNaN(date.getTime())) return "";
    
    // Treat the input date as IST time and format it properly
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    // Return IST formatted string
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+05:30`;
  };

  // Parse IST time string to Date object (for editing existing times)
  const parseISTString = (istTimeString: string): Date | undefined => {
    if (!istTimeString) return undefined;
    
    try {
      // Parse the IST time string as a regular date
      // Since we're treating everything as IST, we can parse it directly
      const date = new Date(istTimeString);
      
      // If it has timezone info (+05:30), it will parse correctly
      // If not, it will be treated as local time, which is what we want for IST
      return date;
    } catch (error) {
      console.error('Error parsing IST time string:', error);
      return undefined;
    }
  };

  // Fetch tests from API with authentication
  useEffect(() => {
    const fetchTests = async () => {
      // Don't fetch if auth is still loading
      if (!user?.email) {
        return;
      }

      try {
        console.log('🔍 UserAccess: Fetching tests with Firebase auth');
        const testsData = await AuthenticatedAdminApiService.getAllTests();
        console.log('✅ Tests fetched with auth:', testsData);
        
        setTests(testsData);
      } catch (error) {
        console.error('❌ Failed to fetch tests:', error);
        toast({
          title: "Error",
          description: "Failed to fetch tests",
          variant: "destructive",
        });
      }
    };

    fetchTests();
  }, [user?.email, toast]);

  const handleStructureUsers = async (queryValue: string) => {
    if (!queryValue.trim()) return;
    
    setUserLoading(true);
    setErrorMessage(''); // Clear previous error
    try {
      const response = await fetch(API_ENDPOINTS.STRUCTURE_USERS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: queryValue
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.users && Array.isArray(result.users)) {
        // Add default toggles to each user
        const usersWithToggles = result.users.map((user: any) => ({
          ...user,
          email_notification: false,
          call_notification: false
        }));
        setStructuredUsers(usersWithToggles);
        setErrorMessage(''); // Clear error on success
      } else {
        // Parse error message from response
        setErrorMessage(result.message || 'Invalid response format');
      }
    } catch (error) {
      console.error('Error structuring users:', error);
      setErrorMessage('Network error. Please try again.');
    } finally {
      setUserLoading(false);
    }
  };

  const handleEditUser = (index: number) => {
    const user = structuredUsers[index];
    setEditForm({
      email: user.user_email,
      start_time: user.start_time,
      end_time: user.end_time,
      email_notification: user.email_notification || false,
      call_notification: user.call_notification || false
    });
    setStartDate(parseISTString(user.start_time));
    setEndDate(parseISTString(user.end_time));
    setEditingUser(index);
  };

  const handleSaveEdit = () => {
    if (editingUser !== null && startDate && endDate) {
      const updatedUsers = [...structuredUsers];
      updatedUsers[editingUser] = {
        user_email: editForm.email,
        start_time: toISTString(startDate),
        end_time: toISTString(endDate),
        email_notification: editForm.email_notification,
        call_notification: editForm.call_notification
      };
      setStructuredUsers(updatedUsers);
      setEditingUser(null);
      setEditForm({ email: '', start_time: '', end_time: '', email_notification: false, call_notification: false });
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({ email: '', start_time: '', end_time: '', email_notification: false, call_notification: false });
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleDeleteUser = (index: number) => {
    const updatedUsers = structuredUsers.filter((_, i) => i !== index);
    setStructuredUsers(updatedUsers);
  };

  const handleManualAddUser = () => {
    if (!newUserEmail.trim() || !newUserStartDate || !newUserEndDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields before adding the user.",
        variant: "destructive",
      });
      return;
    }

    if (!newUserEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    const newUser = {
      user_email: newUserEmail.trim(),
      start_time: toISTString(newUserStartDate),
      end_time: toISTString(newUserEndDate),
      email_notification: newUserEmailNotification,
      call_notification: newUserCallNotification
    };

    setStructuredUsers([...structuredUsers, newUser]);
    
    // Reset form
    setNewUserEmail('');
    setNewUserStartDate(undefined);
    setNewUserEndDate(undefined);
    setNewUserEmailNotification(false);
    setNewUserCallNotification(false);
    setManualAddOpen(false);

    toast({
      title: "User Added",
      description: "User has been successfully added.",
    });
  };

  const handleGiveAccess = async () => {
    if (!selectedTestId) {
      toast({
        title: "Select Test",
        description: "Please select a test before giving access.",
        variant: "destructive",
      });
      return;
    }

    if (structuredUsers.length === 0) {
      toast({
        title: "No Users",
        description: "Please add users before giving access.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const payload = {
      test_id: selectedTestId,
      users: structuredUsers.map(user => ({
        user_email: user.user_email,
        start_time: user.start_time,
        end_time: user.end_time,
        email: user.email_notification || false,
        call: user.call_notification || false
      }))
    };

    try {
      const response = await fetch(API_ENDPOINTS.GIVE_ACCESS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        trackUserAction('access_given', {
          test_id: selectedTestId,
          users_count: structuredUsers.length,
        });

        toast({
          title: "Success",
          description: "Access has been granted successfully!",
        });

        // Reset form
        setStructuredUsers([]);
        setSelectedTestId('');
      } else {
        throw new Error('Failed to give access');
      }
    } catch (error) {
      console.error('Error giving access:', error);
      toast({
        title: "Error",
        description: "Failed to give access. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 p-8 flex justify-center">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Grant User Access</h2>
            <p className="text-muted-foreground">Select a test and assign users with time slots</p>
          </div>

          {/* Test Selection */}
          <div className="mb-8">
            <Label className="text-sm font-medium mb-4 block">Select Test</Label>
            <Select value={selectedTestId} onValueChange={setSelectedTestId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a test to grant access to" />
              </SelectTrigger>
              <SelectContent>
                {tests.map((test) => (
                  <SelectItem key={test.test_id} value={test.test_id}>
                    {test.test_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Input for User Structure */}
          <div className="mb-8">
            <Label className="text-sm font-medium mb-4 block">User & Schedule Structure</Label>
            <AIInputWithLoading
              placeholder="Allocate 5AM -5PM for user!@gmail.com at 24th Jan"
              onSubmit={async (value) => {
                await handleStructureUsers(value);
              }}
              className="w-full"
              minHeight={48}
              maxHeight={120}
            />
            {errorMessage && (
              <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">{errorMessage}</p>
              </div>
            )}
          </div>

          {/* Manual Add Option */}
          <div className="mb-8">
            <div className="flex items-center gap-2">
              <Dialog open={manualAddOpen} onOpenChange={setManualAddOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="solid"
                    color="primary"
                    size="sm"
                    className="rounded-full w-10 h-10 p-0"
                    onClick={() => setManualAddOpen(true)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                  </Button>
                </DialogTrigger>
              </Dialog>
              <span className="text-sm text-muted-foreground">Manually add users</span>
            </div>
            <Dialog open={manualAddOpen} onOpenChange={setManualAddOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Add a user manually and set their time allocation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Email</Label>
                    <Input
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      type="email"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Start Time</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left font-normal"
                          leftIcon={<Clock className="h-4 w-4" />}
                        >
                          {newUserStartDate ? safeFormatDate(newUserStartDate, "PPP hh:mm:ss a") : "Pick start date & time"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3">
                          <Calendar
                            value={newUserStartDate ? dateToInternationalized(newUserStartDate) : undefined}
                            onChange={(value) => {
                              if (value) {
                                const newDate = internationalizedToDate(value);
                                if (newDate && newUserStartDate) {
                                  newDate.setHours(newUserStartDate.getHours(), newUserStartDate.getMinutes(), newUserStartDate.getSeconds());
                                  setNewUserStartDate(newDate);
                                } else {
                                  setNewUserStartDate(newDate);
                                }
                              }
                            }}
                          />
                          <div className="mt-3 pt-3 border-t space-y-3">
                            <div>
                              <label className="text-sm font-medium block mb-2">Start Time</label>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="time"
                                  step="1"
                                  value={newUserStartDate ? safeFormatDate(newUserStartDate, "HH:mm:ss") : ""}
                                  onChange={(e) => {
                                    if (newUserStartDate && e.target.value) {
                                      const [hours, minutes, seconds] = e.target.value.split(':');
                                      const newDate = new Date(newUserStartDate);
                                      const h = parseInt(hours) || 0;
                                      const m = parseInt(minutes) || 0;
                                      const s = parseInt(seconds || '0') || 0;
                                      
                                      if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59) {
                                        newDate.setHours(h, m, s);
                                        setNewUserStartDate(newDate);
                                      }
                                    }
                                  }}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">End Time</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left font-normal"
                          leftIcon={<Clock className="h-4 w-4" />}
                        >
                          {newUserEndDate ? safeFormatDate(newUserEndDate, "PPP hh:mm:ss a") : "Pick end date & time"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3">
                          <Calendar
                            value={newUserEndDate ? dateToInternationalized(newUserEndDate) : undefined}
                            onChange={(value) => {
                              if (value) {
                                const newDate = internationalizedToDate(value);
                                if (newDate && newUserEndDate) {
                                  newDate.setHours(newUserEndDate.getHours(), newUserEndDate.getMinutes(), newUserEndDate.getSeconds());
                                  setNewUserEndDate(newDate);
                                } else {
                                  setNewUserEndDate(newDate);
                                }
                              }
                            }}
                          />
                          <div className="mt-3 pt-3 border-t space-y-3">
                            <div>
                              <label className="text-sm font-medium block mb-2">End Time</label>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="time"
                                  step="1"
                                  value={newUserEndDate ? safeFormatDate(newUserEndDate, "HH:mm:ss") : ""}
                                  onChange={(e) => {
                                    if (newUserEndDate && e.target.value) {
                                      const [hours, minutes, seconds] = e.target.value.split(':');
                                      const newDate = new Date(newUserEndDate);
                                      const h = parseInt(hours) || 0;
                                      const m = parseInt(minutes) || 0;
                                      const s = parseInt(seconds || '0') || 0;
                                      
                                      if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59) {
                                        newDate.setHours(h, m, s);
                                        setNewUserEndDate(newDate);
                                      }
                                    }
                                  }}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Email Notification</Label>
                      <Switch
                        checked={newUserEmailNotification}
                        onCheckedChange={setNewUserEmailNotification}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Call Notification</Label>
                      <Switch
                        checked={newUserCallNotification}
                        onCheckedChange={setNewUserCallNotification}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManualAddOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleManualAddUser}
                      variant="solid"
                      color="primary"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Plus className="h-4 w-4" />}
                    >
                      Add User
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Structured Users Table */}
          {structuredUsers.length > 0 && (
            <div className="space-y-4 mb-8">
              <h3 className="text-lg font-semibold">Structured Users</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Start Time</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">End Time</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Email</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Call</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structuredUsers.map((user, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="px-4 py-3 text-sm">
                          {editingUser === index ? (
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                              className="w-full"
                            />
                          ) : (
                            user.user_email
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {editingUser === index ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start text-left font-normal"
                                  leftIcon={<Clock className="h-4 w-4" />}
                                >
                                  {startDate ? safeFormatDate(startDate, "PPP hh:mm:ss a") : "Pick start date & time"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <div className="p-3">
                                  <Calendar
                                    value={startDate ? dateToInternationalized(startDate) : undefined}
                                    onChange={(value) => {
                                      if (value) {
                                        const newDate = internationalizedToDate(value);
                                        if (newDate && startDate) {
                                          newDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
                                          setStartDate(newDate);
                                        } else {
                                          setStartDate(newDate);
                                        }
                                      }
                                    }}
                                  />
                                  <div className="mt-3 pt-3 border-t space-y-3">
                                    <div>
                                      <label className="text-sm font-medium block mb-2">Start Time</label>
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <Input
                                          type="time"
                                          step="1"
                                          value={startDate ? safeFormatDate(startDate, "HH:mm:ss") : ""}
                                          onChange={(e) => {
                                            if (startDate && e.target.value) {
                                              const [hours, minutes, seconds] = e.target.value.split(':');
                                              const newDate = new Date(startDate);
                                              const h = parseInt(hours) || 0;
                                              const m = parseInt(minutes) || 0;
                                              const s = parseInt(seconds || '0') || 0;
                                              
                                              if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59) {
                                                newDate.setHours(h, m, s);
                                                setStartDate(newDate);
                                              }
                                            }
                                          }}
                                          className="flex-1"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            safeFormatDate(parseISTString(user.start_time), "PPP hh:mm:ss a")
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {editingUser === index ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start text-left font-normal"
                                  leftIcon={<Clock className="h-4 w-4" />}
                                >
                                  {endDate ? safeFormatDate(endDate, "PPP hh:mm:ss a") : "Pick end date & time"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <div className="p-3">
                                  <Calendar
                                    value={endDate ? dateToInternationalized(endDate) : undefined}
                                    onChange={(value) => {
                                      if (value) {
                                        const newDate = internationalizedToDate(value);
                                        if (newDate && endDate) {
                                          newDate.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds());
                                          setEndDate(newDate);
                                        } else {
                                          setEndDate(newDate);
                                        }
                                      }
                                    }}
                                  />
                                  <div className="mt-3 pt-3 border-t space-y-3">
                                    <div>
                                      <label className="text-sm font-medium block mb-2">End Time</label>
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <Input
                                          type="time"
                                          step="1"
                                          value={endDate ? safeFormatDate(endDate, "HH:mm:ss") : ""}
                                          onChange={(e) => {
                                            if (endDate && e.target.value) {
                                              const [hours, minutes, seconds] = e.target.value.split(':');
                                              const newDate = new Date(endDate);
                                              const h = parseInt(hours) || 0;
                                              const m = parseInt(minutes) || 0;
                                              const s = parseInt(seconds || '0') || 0;
                                              
                                              if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59) {
                                                newDate.setHours(h, m, s);
                                                setEndDate(newDate);
                                              }
                                            }
                                          }}
                                          className="flex-1"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            safeFormatDate(parseISTString(user.end_time), "PPP hh:mm:ss a")
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={editingUser === index ? editForm.email_notification : (user.email_notification || false)}
                            onCheckedChange={(checked) => {
                              if (editingUser === index) {
                                setEditForm({...editForm, email_notification: checked});
                              } else {
                                const updatedUsers = [...structuredUsers];
                                updatedUsers[index].email_notification = checked;
                                setStructuredUsers(updatedUsers);
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={editingUser === index ? editForm.call_notification : (user.call_notification || false)}
                            onCheckedChange={(checked) => {
                              if (editingUser === index) {
                                setEditForm({...editForm, call_notification: checked});
                              } else {
                                const updatedUsers = [...structuredUsers];
                                updatedUsers[index].call_notification = checked;
                                setStructuredUsers(updatedUsers);
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            {editingUser === index ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleSaveEdit}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  className="h-8 w-8 p-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditUser(index)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteUser(index)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Give Access Button */}
          <div className="flex justify-center">
            <Button 
              onClick={handleGiveAccess} 
              disabled={loading || !selectedTestId || structuredUsers.length === 0}
              variant="solid"
              color="primary"
              size="md"
              leftIcon={!loading ? <Check className="h-4 w-4" /> : undefined}
            >
              {loading ? "Granting Access..." : "Give Access"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
