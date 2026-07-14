import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { setAnonIdGetter } from '@workspace/api-client-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getDeviceId } from '@/lib/device';
import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';
import Setup from '@/pages/setup';
import Exam from '@/pages/exam';
import Results from '@/pages/results';
import Review from '@/pages/review';
import Progress from '@/pages/progress';

const queryClient = new QueryClient();

// Every API call that needs device-scoped progress sends this anonymous id
// (no login system in this app).
setAnonIdGetter(() => getDeviceId());

function Router() {
  return (
    <div className="w-full max-w-[480px] mx-auto min-h-[100dvh] bg-background shadow-2xl relative overflow-x-hidden">
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/setup/:mode/:code?" component={Setup} />
        <Route path="/exam" component={Exam} />
        <Route path="/results/:id" component={Results} />
        <Route path="/review/:id" component={Review} />
        <Route path="/progress" component={Progress} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <div className="min-h-screen bg-slate-100 flex justify-center">
            <Router />
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;