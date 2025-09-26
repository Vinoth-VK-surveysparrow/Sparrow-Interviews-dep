import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { API_ENDPOINTS, API_CONFIG } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Stepper, 
  StepperItem, 
  StepperTrigger, 
  StepperIndicator, 
  StepperTitle, 
  StepperDescription,
  StepperNav,
  StepperContent,
  StepperPanel,
  StepperSeparator
} from '@/components/ui/stepper';
import { Plus, Trash2, Check, ChevronRight, FileText, Users, Send, Loader2, Edit, Save, X, Clock, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import { useTheme } from '@/components/ThemeProvider';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AIInputWithLoading } from '@/components/ui/ai-input-with-loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar-rac';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { parseDate, today, getLocalTimeZone } from '@internationalized/date';

interface Assessment {
  assessment_id: string;
  name: string;
  description: string;
  no_of_questions: number;
  order: number;
  time_limit: number;
  type: 'QA' | 'rapid-fire' | 'conductor' | 'triple-step' | 'games-arena';
  num_words?: number; // For triple-step assessments
  time_interval?: { // For triple-step assessments
    dropFrequencyMin: number;
    start_delay: number;
    dropFrequencyMax: number;
    integrationTime: number;
  };
  questions?: {
    questions?: Array<{
      id: string;
      text: string;
    }>;
    words?: string[]; // For triple-step assessments
    gameSettings?: {
      changeFrequency: number;
      defaultEnergyLevel: number;
    };
    topics?: string[];
  };
}

interface TimeSlot {
  start_time: string;
  end_time: string;
}

interface CreateTestPayload {
  test_id: string;
  test_name: string;
  description: string;
  creator_email: string;
  assessments: Assessment[];
  user_emails?: Array<{
    email: string;
    email_notification: boolean;
    call_notification: boolean;
  }>;
  time_slots?: TimeSlot[];
}

export default function CreateAssessment() {
  const { theme } = useTheme();
  const [activeStep, setActiveStep] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: boolean}>({});
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [generatedQuestions, setGeneratedQuestions] = useState<{[key: number]: any}>({});
  const [query, setQuery] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);
  const [leftPanelHeight, setLeftPanelHeight] = useState(0);
  const leftPanelRef = React.useRef<HTMLDivElement>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [structuredUsers, setStructuredUsers] = useState<any[]>([]);
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
  const [testIdLoading, setTestIdLoading] = useState(false);
  const [assessmentIdLoading, setAssessmentIdLoading] = useState(false);
  const [showQuestionsError, setShowQuestionsError] = useState(false);

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

  // Step 1: Test Details
  const [testDetails, setTestDetails] = useState({
    test_id: '',
    test_name: '',
    description: ''
  });

  // Step 2: Assessments
  const [assessments, setAssessments] = useState<Assessment[]>([
    {
      assessment_id: '',
      name: '',
      description: '',
      no_of_questions: 15,
      order: 1,
      time_limit: 120,
      type: 'QA',
      questions: {
        questions: []
      }
    }
  ]);

  // Step 3: Users and Time Slots

  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { trackUserAction } = useClarity(true, 'Create Assessment');

  // Generate UUID function
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleGenerateTestId = async () => {
    const newUuid = generateUUID();
    setTestIdLoading(true);
    
    // Set UUID immediately
    setTestDetails({...testDetails, test_id: newUuid});
    
    // Generate description if test name exists
    if (testDetails.test_name.trim()) {
      try {
        const response = await fetch(API_ENDPOINTS.CREATE_DESCRIPTION, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: testDetails.test_name,
            type: "test"
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.description) {
            setTestDetails(prev => ({...prev, test_id: newUuid, description: result.description}));
          }
        }
      } catch (error) {
        console.error('Error generating description:', error);
      }
    }
    
    setTestIdLoading(false);
  };

  const handleGenerateAssessmentId = async () => {
    const newUuid = generateUUID();
    setAssessmentIdLoading(true);
    
    // Set UUID immediately
    updateAssessment(assessmentStep, 'assessment_id', newUuid);
    
    // Generate description if assessment name exists
    if (assessments[assessmentStep].name.trim()) {
      try {
        const response = await fetch(API_ENDPOINTS.CREATE_DESCRIPTION, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: assessments[assessmentStep].name,
            type: "assessment"
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.description) {
            // Update description while preserving the UUID
            const updatedAssessments = [...assessments];
            updatedAssessments[assessmentStep] = {
              ...updatedAssessments[assessmentStep],
              assessment_id: newUuid,
              description: result.description
            };
            setAssessments(updatedAssessments);
          }
        }
      } catch (error) {
        console.error('Error generating description:', error);
      }
    }
    
    setAssessmentIdLoading(false);
  };

  const addAssessment = () => {
    const newAssessment: Assessment = {
      assessment_id: '',
      name: '',
      description: '',
      no_of_questions: 15,
      order: assessments.length + 1,
      time_limit: 120,
      type: 'QA',
      questions: {
        questions: []
      }
    };
    setAssessments([...assessments, newAssessment]);
  };

  const removeAssessment = (index: number) => {
    if (assessments.length > 1) {
      // Remove the assessment at the specified index
      const updatedAssessments = assessments.filter((_, i) => i !== index);
      setAssessments(updatedAssessments);
      
      // Clean up generated questions for the deleted assessment
      const updatedGeneratedQuestions = { ...generatedQuestions };
      delete updatedGeneratedQuestions[index];
      
      // Shift generated questions for assessments that come after the deleted one
      const shiftedGeneratedQuestions: {[key: number]: any} = {};
      Object.keys(updatedGeneratedQuestions).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          shiftedGeneratedQuestions[oldIndex - 1] = updatedGeneratedQuestions[oldIndex];
        } else if (oldIndex < index) {
          shiftedGeneratedQuestions[oldIndex] = updatedGeneratedQuestions[oldIndex];
        }
      });
      setGeneratedQuestions(shiftedGeneratedQuestions);
      
      // Adjust assessmentStep if it's pointing to a removed assessment
      if (assessmentStep >= index && assessmentStep > 0) {
        setAssessmentStep(assessmentStep - 1);
      } else if (assessmentStep >= updatedAssessments.length) {
        setAssessmentStep(updatedAssessments.length - 1);
      }
    }
  };

  const updateAssessment = (index: number, field: keyof Assessment, value: any) => {
    const updated = [...assessments];
    updated[index] = { ...updated[index], [field]: value };
    setAssessments(updated);
  };

  const updateAssessmentQuestions = (index: number, questionsJson: string) => {
    try {
      const questions = JSON.parse(questionsJson);
      updateAssessment(index, 'questions', questions);
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON format for questions",
        variant: "destructive",
      });
    }
  };

  const getQuestionsPlaceholder = (type: string) => {
    switch (type) {
      case 'QA':
      case 'rapid-fire':
        return `{
  "questions": [
    {
      "id": "1",
      "text": "What are the key principles of sales?"
    },
    {
      "id": "2",
      "text": "How do you handle customer objections?"
    }
  ]
}`;
      case 'conductor':
      case 'triple-step':
        return `{
  "gameSettings": {
    "changeFrequency": 15,
    "defaultEnergyLevel": 5
  },
  "topics": [
    "The importance of building customer relationships",
    "How to present product benefits effectively"
  ]
}`;
      case 'games-arena':
        return `{
  "note": "Games-arena type doesn't require questions - uses predefined S3 path"
}`;
      default:
        return `{
  "questions": [
    {
      "id": "1",
      "text": "Your question here"
    }
  ]
}`;
    }
  };


  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(testDetails.test_id.trim() && testDetails.test_name.trim() && testDetails.description.trim());
      case 2:
        return assessments.every(a => {
          const basicFieldsValid = a.assessment_id.trim() && a.name.trim() && a.description.trim();
          
          // For games-arena, only basic fields are required
          if (a.type === 'games-arena') {
            return basicFieldsValid;
          }
          
          // For other types, require both basic fields AND generated questions
          const hasGeneratedQuestions = generatedQuestions[assessments.indexOf(a)] !== undefined;
          return basicFieldsValid && hasGeneratedQuestions;
        });
      case 3:
        return true; // User allocation is now optional
      default:
        return false;
    }
  };

  const validateAndShowErrors = (step: number): boolean => {
    const errors: {[key: string]: boolean} = {};
    let isValid = true;

    switch (step) {
      case 1:
        if (!testDetails.test_id.trim()) {
          errors['test_id'] = true;
          isValid = false;
        }
        if (!testDetails.test_name.trim()) {
          errors['test_name'] = true;
          isValid = false;
        }
        if (!testDetails.description.trim()) {
          errors['description'] = true;
          isValid = false;
        }
        break;
      case 2:
        assessments.forEach((a, index) => {
          if (!a.assessment_id.trim()) {
            errors[`assessment_${index}_id`] = true;
            isValid = false;
          }
          if (!a.name.trim()) {
            errors[`assessment_${index}_name`] = true;
            isValid = false;
          }
          if (!a.description.trim()) {
            errors[`assessment_${index}_description`] = true;
            isValid = false;
          }
          
          // For non-games-arena types, check if questions are generated
          if (a.type !== 'games-arena' && !generatedQuestions[index]) {
            errors[`assessment_${index}_questions`] = true;
            isValid = false;
            setShowQuestionsError(true);
          }
        });
        break;
      case 3:
        if (structuredUsers.length === 0) {
          errors['structured_users'] = true;
          isValid = false;
        }
        break;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleStepChange = (step: number) => {
    // Allow going back to completed steps
    if (step < activeStep) {
      setActiveStep(step);
      setValidationErrors({}); // Clear errors when going back
      return;
    }

    // Allow progressing to next step only if current step is valid
    if (step === activeStep + 1) {
      const isValid = validateStep(activeStep);
      console.log(`Validating step ${activeStep}:`, isValid);
      console.log('Current assessments:', assessments);
      
      if (isValid) {
        setValidationErrors({}); // Clear errors on successful validation
        setActiveStep(step);
      } else {
        // Show validation errors for current step
        validateAndShowErrors(activeStep);
        toast({
          title: "Complete Current Step",
          description: "Please fill in all required fields and generate questions for all assessments before proceeding.",
          variant: "destructive",
        });
      }
      return;
    }

    // Prevent jumping ahead to incomplete steps
    if (step > activeStep) {
      toast({
        title: "Complete Steps in Order",
        description: "Please complete all previous steps before jumping ahead.",
        variant: "destructive",
      });
      return;
    }
  };

  const handleNext = () => {
    handleStepChange(activeStep + 1);
  };

  const handlePrevious = () => {
    handleStepChange(activeStep - 1);
  };

  const canGenerateQuestions = (index: number): boolean => {
    const assessment = assessments[index];
    if (assessment.type === 'games-arena') return false;
    return !!(assessment.no_of_questions && assessment.type);
  };

  const handleAIQuestionsGenerated = (index: number, data: any) => {
    setGeneratedQuestions(prev => ({
      ...prev,
      [index]: data
    }));
    
    // Update the assessment with generated questions
    const updated = [...assessments];
    updated[index] = { ...updated[index], questions: data };
    setAssessments(updated);
    
    // Clear the questions error when questions are generated
    setShowQuestionsError(false);
  };

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
    setStartDate(new Date(user.start_time));
    setEndDate(new Date(user.end_time));
    setEditingUser(index);
  };

  const handleSaveEdit = () => {
    if (editingUser !== null && startDate && endDate) {
      const updatedUsers = [...structuredUsers];
      updatedUsers[editingUser] = {
        user_email: editForm.email,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
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
      start_time: newUserStartDate.toISOString(),
      end_time: newUserEndDate.toISOString(),
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
      description: "User has been successfully added to the assessment.",
    });
  };

  // Update right panel height to match left panel
  React.useEffect(() => {
    const updateHeight = () => {
      if (leftPanelRef.current) {
        setLeftPanelHeight(leftPanelRef.current.offsetHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    
    return () => window.removeEventListener('resize', updateHeight);
  }, [assessments, assessmentStep]);

  // Auto-hide questions error after 5 seconds
  React.useEffect(() => {
    if (showQuestionsError) {
      const timer = setTimeout(() => {
        setShowQuestionsError(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showQuestionsError]);

  const getQuestionPlaceholder = (type: string) => {
    switch (type) {
      case 'QA':
        return 'Describe the type of QA questions needed...';
      case 'rapid-fire':
        return 'Describe the type of rapid-fire questions needed...';
      case 'conductor':
        return 'Describe the topics for conductor assessment...';
      case 'triple-step':
        return 'Describe the type of triple-step questions needed...';
      default:
        return 'Describe the type of questions needed...';
    }
  };

  const getApiUrl = (type: string) => {
    switch (type) {
      case 'QA':
        return API_ENDPOINTS.QA;
      case 'rapid-fire':
        return API_ENDPOINTS.RAPID_FIRE;
      case 'conductor':
        return API_ENDPOINTS.CONDUCTOR;
      case 'triple-step':
        return API_ENDPOINTS.TRIPLE_STEP;
      case 'games-arena':
        return API_ENDPOINTS.GAMES_ARENA;
      default:
        return API_ENDPOINTS.QA;
    }
  };

  const handleGenerateQuestions = async (index: number, queryValue?: string) => {
    if (!canGenerateQuestions(index)) {
      toast({
        title: "Missing Information",
        description: "Please fill in the number of questions and assessment type first.",
        variant: "destructive",
      });
      return;
    }

    const queryToUse = queryValue || query;
    if (!queryToUse.trim()) {
      toast({
        title: "Query Required",
        description: "Please describe the type of questions you need.",
        variant: "destructive",
      });
      return;
    }

    setQuestionLoading(true);
    try {
      const assessment = assessments[index];
      const payload: any = {
        query: queryToUse.trim(),
        num_questions: assessment.no_of_questions
      };

      if (assessment.type === 'triple-step' && assessment.num_words) {
        payload.num_words = assessment.num_words;
      }

      const response = await fetch(getApiUrl(assessment.type), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        handleAIQuestionsGenerated(index, result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setQuestionLoading(false);
    }
  };

  const renderGeneratedQuestions = (index: number) => {
    const data = generatedQuestions[index];
    if (!data) return null;

    const assessment = assessments[index];

    if (assessment.type === 'conductor') {
      return (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-3 text-sm">Topics ({data.topics?.length || 0})</h4>
            <div className="space-y-2">
              {data.topics?.map((topic: string, topicIndex: number) => (
                <div key={topicIndex} className="bg-muted/50 rounded-lg p-3 shadow-sm border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                      <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                      <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                      <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                      <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{topic}</div>
                      <div className="text-xs text-muted-foreground">Topic {topicIndex + 1}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (assessment.type === 'triple-step') {
      return (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-3 text-sm">Questions ({data.questions?.length || 0})</h4>
            <div className="space-y-2">
              {data.questions?.map((q: any, qIndex: number) => (
                <div key={q.id || qIndex} className="bg-muted/50 rounded-lg p-3 shadow-sm border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                      <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                      <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                      <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                      <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">Question {q.id}</div>
                      <div className="text-xs text-muted-foreground">{q.text}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-3 text-sm">Words ({data.words?.length || 0})</h4>
            <div className="flex flex-wrap gap-1">
              {data.words?.map((word: string, wordIndex: number) => (
                <span key={wordIndex} className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // QA and rapid-fire
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Questions ({data.questions?.length || 0})</h4>
        <div className="space-y-2">
          {data.questions?.map((q: any, qIndex: number) => (
            <div key={q.id || qIndex} className="bg-muted/50 rounded-lg p-3 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                  <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                  <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                  <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                  <div className="w-1 h-1 bg-muted-foreground/60 rounded-sm"></div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Question {q.id}</div>
                  <div className="text-xs text-muted-foreground">{q.text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };


  const handleSubmit = async () => {
    if (!user?.email) {
      toast({
        title: "Authentication Required",
        description: "Please ensure you are logged in",
        variant: "destructive",
      });
      return;
    }

    // Validate all steps before submission
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      // Show validation errors for all steps
      validateAndShowErrors(1);
      validateAndShowErrors(2);
      validateAndShowErrors(3);
      toast({
        title: "Incomplete Form",
        description: "Please complete all steps before submitting",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Filter and prepare assessments, removing questions field for games-arena type
    const preparedAssessments = assessments
      .filter(a => a.assessment_id && a.name)
      .map(a => {
        if (a.type === 'games-arena') {
          const { questions, ...assessmentWithoutQuestions } = a;
          return assessmentWithoutQuestions;
        }
        
        // Convert assessment types to proper API format
        const assessment = { ...a };
        if (assessment.type === 'conductor') {
          assessment.type = 'Conductor' as any;
        }
        if (assessment.type === 'triple-step') {
          assessment.type = 'Triple-Step' as any;
        }
        if (assessment.type === 'games-arena') {
          assessment.type = 'Games-arena' as any;
        }
        
        return assessment;
      });

    // Debug: Log prepared assessments to check time_interval
    console.log('🔍 Prepared assessments before API call:', preparedAssessments);
    preparedAssessments.forEach((assessment, index) => {
      if ((assessment as any).type === 'Triple-Step' || (assessment as any).type === 'triple-step') {
        console.log(`🔍 Triple-step assessment ${index}:`, {
          assessment_id: assessment.assessment_id,
          type: (assessment as any).type,
          time_interval: (assessment as any).time_interval,
          has_time_interval: !!(assessment as any).time_interval
        });
      }
    });

    const payload: CreateTestPayload = {
      ...testDetails,
      creator_email: user.email,
      assessments: preparedAssessments,
      ...(structuredUsers.length > 0 && {
        user_emails: structuredUsers.map(user => ({
          email: user.user_email,
          email_notification: user.email_notification || false,
          call_notification: user.call_notification || false
        })),
        time_slots: structuredUsers.map(user => ({
          start_time: user.start_time,
          end_time: user.end_time
        }))
      })
    };

    console.log('🔍 Final payload being sent:', JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(API_ENDPOINTS.CREATE_COMPLETE_TEST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        trackUserAction('assessment_created', {
          test_id: payload.test_id,
          test_name: payload.test_name,
          assessments_count: payload.assessments.length,
          users_count: payload.user_emails?.length || 0,
        });

        toast({
          title: "Success",
          description: "Assessment created successfully!",
        });

        setLocation('/admin/tests');
      } else {
        throw new Error('Failed to create assessment');
      }
    } catch (error) {
      console.error('Error creating assessment:', error);
      toast({
        title: "Error",
        description: "Failed to create assessment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-background">
      {/* Left Sidebar with Stepper */}
      <div className="w-80 border-r border-border p-6" style={(theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)) ? { backgroundColor: '#f6f6f6' } : undefined}>
        {/* Header */}
        <div className="mb-8 rounded-lg p-4 -m-2" style={(theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)) ? { backgroundColor: '#f6f6f6' } : undefined}>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Create Assessment
          </h1>
        </div>

        {/* Vertical Stepper */}
        <Stepper value={activeStep} onValueChange={handleStepChange} orientation="vertical" className="space-y-6 rounded-lg p-4 -m-2" style={(theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)) ? { backgroundColor: '#f6f6f6' } : undefined}>
          <StepperItem step={1} completed={activeStep > 1}>
            <StepperTrigger className="w-full justify-start p-3 rounded-lg hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <StepperIndicator className="flex-shrink-0">1</StepperIndicator>
                <div className="text-left">
                  <StepperTitle className="text-sm font-medium">Test</StepperTitle>
                  <StepperDescription className="text-xs text-muted-foreground">Basic test information</StepperDescription>
                </div>
              </div>
            </StepperTrigger>
            <StepperSeparator className="ml-6 mt-2 h-8 w-0.5 bg-muted data-[state=completed]:bg-primary data-[state=active]:bg-primary" />
          </StepperItem>

          <StepperItem step={2} completed={activeStep > 2}>
            <StepperTrigger
              className="w-full justify-start p-3 rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={activeStep < 2}
            >
              <div className="flex items-center gap-3">
                <StepperIndicator className="flex-shrink-0">2</StepperIndicator>
                <div className="text-left">
                  <StepperTitle className="text-sm font-medium">Assessments</StepperTitle>
                  <StepperDescription className="text-xs text-muted-foreground">Create assessment sections</StepperDescription>
                </div>
              </div>
            </StepperTrigger>
            <StepperSeparator className="ml-6 mt-2 h-8 w-0.5 bg-muted data-[state=completed]:bg-primary data-[state=active]:bg-primary" />
          </StepperItem>

          <StepperItem step={3}>
            <StepperTrigger
              className="w-full justify-start p-3 rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={activeStep < 3}
            >
              <div className="flex items-center gap-3">
                <StepperIndicator className="flex-shrink-0">3</StepperIndicator>
                <div className="text-left">
                  <StepperTitle className="text-sm font-medium">Users & Schedule (Optional)</StepperTitle>
                  <StepperDescription className="text-xs text-muted-foreground">Assign users and time slots - optional</StepperDescription>
                </div>
              </div>
            </StepperTrigger>
          </StepperItem>
        </Stepper>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 flex justify-center">
        <div className="w-full max-w-4xl">
          {/* Step Content */}
          <div className="mb-8">
            {activeStep === 1 && (
              <div className="max-w-md mx-auto space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-foreground mb-2">Test Information</h2>
                  <p className="text-muted-foreground">Enter basic test details to get started</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="test_name" className="text-sm font-medium mb-2 block">Test Name</Label>
                    <Input
                      id="test_name"
                      value={testDetails.test_name}
                      onChange={(e) => setTestDetails({...testDetails, test_name: e.target.value})}
                      placeholder="e.g., Sales Assessment Test"
                      className={validationErrors['test_name'] ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="test_id" className="text-sm font-medium mb-2 block">Test ID</Label>
                    <div className="relative">
                      <Input
                        id="test_id"
                        value={testDetails.test_id}
                        onChange={(e) => setTestDetails({...testDetails, test_id: e.target.value})}
                        placeholder="e.g., test-001"
                        className={`pr-10 ${validationErrors['test_id'] ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleGenerateTestId}
                              disabled={testIdLoading}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                            >
                              {testIdLoading ? (
                                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Generate unique ID and AI-powered description based on test name</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-sm font-medium mb-2 block">Description</Label>
                    <Textarea
                      id="description"
                      value={testDetails.description}
                      onChange={(e) => setTestDetails({...testDetails, description: e.target.value})}
                      placeholder="Comprehensive assessment description"
                      rows={3}
                      className={validationErrors['description'] ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="w-full h-full flex flex-col">
                {/* Assessment Stepper */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="flex items-center gap-2">
                    {assessments.map((_, index) => (
                      <React.Fragment key={index}>
                        <Button
                          variant={assessmentStep === index ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAssessmentStep(index)}
                          className="w-10 h-10 rounded-full p-0"
                        >
                          {index + 1}
                        </Button>
                        {index < assessments.length - 1 && (
                          <div className="w-8 h-0.5 bg-muted" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addAssessment}
                    className="w-10 h-10 rounded-full p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Two Column Layout - Fixed Height */}
                <div className="grid grid-cols-2 gap-8 flex-1 min-h-0">
                  {/* Left Half - Input Form - Scrollable */}
                  <div className="overflow-y-auto space-y-6 pr-2 pl-1" ref={leftPanelRef}>
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-lg font-semibold">Assessment {assessmentStep + 1}</h4>
                      {assessments.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeAssessment(assessmentStep)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-6">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Name</Label>
                        <Input
                          value={assessments[assessmentStep].name}
                          onChange={(e) => updateAssessment(assessmentStep, 'name', e.target.value)}
                          placeholder="e.g., Technical Questions"
                          className={validationErrors[`assessment_${assessmentStep}_name`] ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Assessment ID</Label>
                        <div className="relative">
                          <Input
                            value={assessments[assessmentStep].assessment_id}
                            onChange={(e) => updateAssessment(assessmentStep, 'assessment_id', e.target.value)}
                            placeholder="e.g., llm-001"
                            className={`pr-10 ${validationErrors[`assessment_${assessmentStep}_id`] ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          />
                          <TooltipProvider>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleGenerateAssessmentId}
                                  disabled={assessmentIdLoading}
                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                                >
                                  {assessmentIdLoading ? (
                                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Generate unique ID and AI-powered description based on assessment name</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <Label className="text-sm font-medium mb-2 block">Description</Label>
                      <Input
                        value={assessments[assessmentStep].description}
                        onChange={(e) => updateAssessment(assessmentStep, 'description', e.target.value)}
                        placeholder="Assessment description"
                        className={validationErrors[`assessment_${assessmentStep}_description`] ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label className="text-sm font-medium">Number of Questions</Label>
                          <TooltipProvider>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <div className="w-4 h-4 rounded-full bg-gray-400 hover:bg-gray-500 cursor-pointer flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">i</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs text-sm">
                                  Set 50-60 questions initially, then reduce to 10-15 after generation. 
                                  This improves randomness by selecting from a larger pool.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          type="number"
                          value={assessments[assessmentStep].type === 'games-arena' ? 0 : assessments[assessmentStep].no_of_questions}
                          onChange={(e) => updateAssessment(assessmentStep, 'no_of_questions', assessments[assessmentStep].type === 'games-arena' ? 0 : parseInt(e.target.value) || 15)}
                          min={assessments[assessmentStep].type === 'games-arena' ? "0" : "1"}
                          disabled={assessments[assessmentStep].type === 'games-arena'}
                          className={assessments[assessmentStep].type === 'games-arena' ? 'opacity-50 cursor-not-allowed' : ''}
                        />
                        {assessments[assessmentStep].type === 'games-arena' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Games Arena assessments don't use question count
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Time Limit (seconds)</Label>
                        <Input
                          type="number"
                          value={assessments[assessmentStep].time_limit}
                          onChange={(e) => updateAssessment(assessmentStep, 'time_limit', parseInt(e.target.value) || 120)}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Type</Label>
                        <select
                          value={assessments[assessmentStep].type}
                          onChange={(e) => {
                            const newType = e.target.value as Assessment['type'];
                            updateAssessment(assessmentStep, 'type', newType);
                            
                            // Initialize time_interval for triple-step assessments
                            if (newType === 'triple-step' && !assessments[assessmentStep].time_interval) {
                              updateAssessment(assessmentStep, 'time_interval', {
                                dropFrequencyMin: 10,
                                start_delay: 10,
                                dropFrequencyMax: 20,
                                integrationTime: 8
                              });
                            }
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs shadow-black/5 transition-[color,box-shadow]"
                        >
                          <option value="QA">QA</option>
                          <option value="rapid-fire">Rapid Fire</option>
                          <option value="conductor">Conductor</option>
                          <option value="triple-step">Triple Step</option>
                          <option value="games-arena">Games Arena</option>
                        </select>
                      </div>
                      
                      {/* Triple Step - Number of Words Field */}
                      {assessments[assessmentStep].type === 'triple-step' && (
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Number of Words</Label>
                          <Input
                            type="number"
                            value={assessments[assessmentStep].num_words || 20}
                            onChange={(e) => updateAssessment(assessmentStep, 'num_words', parseInt(e.target.value) || 20)}
                            min="1"
                            placeholder="20"
                          />
                        </div>
                      )}

                      {/* Triple Step - Time Interval Fields */}
                      {assessments[assessmentStep].type === 'triple-step' && (
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-muted-foreground">Time Interval Settings</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Drop Frequency Min (seconds)</Label>
                              <Input
                                type="number"
                                value={assessments[assessmentStep].time_interval?.dropFrequencyMin || 10}
                                onChange={(e) => {
                                  const currentInterval = assessments[assessmentStep].time_interval || {};
                                  updateAssessment(assessmentStep, 'time_interval', {
                                    ...currentInterval,
                                    dropFrequencyMin: parseInt(e.target.value) || 10
                                  });
                                }}
                                min="1"
                                placeholder="10"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Drop Frequency Max (seconds)</Label>
                              <Input
                                type="number"
                                value={assessments[assessmentStep].time_interval?.dropFrequencyMax || 20}
                                onChange={(e) => {
                                  const currentInterval = assessments[assessmentStep].time_interval || {};
                                  updateAssessment(assessmentStep, 'time_interval', {
                                    ...currentInterval,
                                    dropFrequencyMax: parseInt(e.target.value) || 20
                                  });
                                }}
                                min="1"
                                placeholder="20"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Start Delay (seconds)</Label>
                              <Input
                                type="number"
                                value={assessments[assessmentStep].time_interval?.start_delay || 10}
                                onChange={(e) => {
                                  const currentInterval = assessments[assessmentStep].time_interval || {};
                                  updateAssessment(assessmentStep, 'time_interval', {
                                    ...currentInterval,
                                    start_delay: parseInt(e.target.value) || 10
                                  });
                                }}
                                min="0"
                                placeholder="10"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Integration Time (seconds)</Label>
                              <Input
                                type="number"
                                value={assessments[assessmentStep].time_interval?.integrationTime || 8}
                                onChange={(e) => {
                                  const currentInterval = assessments[assessmentStep].time_interval || {};
                                  updateAssessment(assessmentStep, 'time_interval', {
                                    ...currentInterval,
                                    integrationTime: parseInt(e.target.value) || 8
                                  });
                                }}
                                min="1"
                                placeholder="8"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Question Generation - Left Side - New Design */}
                    {assessments[assessmentStep].type !== 'games-arena' && (
                      <div className="mb-6">
                        <Label className={`text-sm font-medium mb-2 block ${validationErrors[`assessment_${assessmentStep}_questions`] ? 'text-red-500' : ''}`}>
                          Question Generation {validationErrors[`assessment_${assessmentStep}_questions`] && <span className="text-red-500">*</span>}
                        </Label>
                        <AIInputWithLoading
                          placeholder={getQuestionPlaceholder(assessments[assessmentStep].type)}
                          onSubmit={async (value) => {
                            await handleGenerateQuestions(assessmentStep, value);
                          }}
                          className={`w-full ${validationErrors[`assessment_${assessmentStep}_questions`] ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          minHeight={48}
                          maxHeight={120}
                        />
                        {showQuestionsError && (
                          <p className="text-xs text-red-500 mt-1">Questions must be generated before proceeding</p>
                        )}
                      </div>
                    )}

                    {assessments[assessmentStep].type === 'games-arena' && (
                      <div className="p-4 bg-muted/50 rounded-lg mb-6">
                        <p className="text-sm text-muted-foreground">
                          <strong>Games Arena:</strong> This assessment type uses predefined games and doesn't require custom questions.
                          
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Half - Generated Questions Viewer - Dynamic Height */}
                  <div 
                    className="flex flex-col"
                    style={{ height: leftPanelHeight > 0 ? `${leftPanelHeight}px` : '384px' }}
                  >
                    <div className="flex-1 overflow-y-auto">
                      {generatedQuestions[assessmentStep] ? (
                        <div className="space-y-3">
                          {renderGeneratedQuestions(assessmentStep)}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                          <div>
                            <p className="mb-2">No questions generated yet</p>
                            <p className="text-sm">Use the question generation tool on the left to create questions</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div className="w-full max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-foreground mb-2">Users & Schedule (Optional)</h2>
                  <p className="text-muted-foreground">Use AI to structure user emails and time slots - this step is optional</p>
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
                          variant="outline"
                          size="icon"
                          className="rounded-full"
                          onClick={() => setManualAddOpen(true)}
                        >
                          <Plus className="h-4 w-4" />
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
                                className="w-full justify-start text-left font-normal"
                              >
                                <Clock className="mr-2 h-4 w-4" />
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
                                className="w-full justify-start text-left font-normal"
                              >
                                <Clock className="mr-2 h-4 w-4" />
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
                            onClick={() => setManualAddOpen(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleManualAddUser}
                            className="flex-1"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add User
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Structured Users Table */}
                {structuredUsers.length > 0 && (
                  <div className="space-y-4">
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
                                        className="w-full justify-start text-left font-normal"
                                      >
                                        <Clock className="mr-2 h-4 w-4" />
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
                                                // Preserve the time from the original date
                                                newDate.setHours(startDate.getHours(), startDate.getMinutes());
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
                                  safeFormatDate(new Date(user.start_time), "PPP hh:mm:ss a")
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {editingUser === index ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal"
                                      >
                                        <Clock className="mr-2 h-4 w-4" />
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
                                                // Preserve the time from the original date
                                                newDate.setHours(endDate.getHours(), endDate.getMinutes());
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
                                  safeFormatDate(new Date(user.end_time), "PPP hh:mm:ss a")
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
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={activeStep === 1}
              className={activeStep === 1 ? 'invisible' : ''}
            >
              Previous
            </Button>

            {activeStep < 3 ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>Creating...</>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Assessment
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
