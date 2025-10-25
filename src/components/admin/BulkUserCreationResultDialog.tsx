import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { showSuccess } from '@/utils/toast';
import { Copy } from 'lucide-react';

type SuccessResult = {
  name: string;
  email: string;
  password: string;
};

type FailureResult = {
  name: string;
  error: string;
};

type BulkCreationResult = {
  successes: SuccessResult[];
  failures: FailureResult[];
};

type Props = {
  result: BulkCreationResult;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const BulkUserCreationResultDialog = ({ result, isOpen, onOpenChange }: Props) => {
  const handleCopyToClipboard = () => {
    const textToCopy = result.successes
      .map(s => `Name: ${s.name}, Email: ${s.email}, Password: ${s.password}`)
      .join('\n');
    navigator.clipboard.writeText(textToCopy);
    showSuccess('Copied credentials to clipboard!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk Creation Results</DialogTitle>
          <DialogDescription>
            Review the results of the user creation process. Save the passwords securely.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {result.successes.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-green-600">Successful Creations ({result.successes.length})</h3>
              <ScrollArea className="h-64 w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.successes.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell className="font-mono">{s.password}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
          {result.failures.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-red-600">Failed Creations ({result.failures.length})</h3>
              <ScrollArea className="h-48 w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.failures.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell>{f.name}</TableCell>
                        <TableCell className="text-destructive">{f.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          {result.successes.length > 0 && (
            <Button onClick={handleCopyToClipboard}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Successful Credentials
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUserCreationResultDialog;