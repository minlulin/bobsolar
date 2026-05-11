'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Layout,
  Edit,
  Loader2,
} from 'lucide-react';
import { useCustomer } from '@/hooks/use-customers';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useState } from 'react';
import { CustomerDialog } from '@/components/customers/customer-dialog';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: response, isLoading } = useCustomer(id);
  const customer = response?.success ? response.data : null;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="text-solar h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-2xl font-bold">Customer not found</h2>
        <Button
          variant="link"
          onClick={() => { router.push('/customers'); }}
          className="mt-4"
        >
          Back to list
        </Button>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { router.push('/customers'); }}
        className="group text-muted-foreground hover:text-foreground -ml-2"
      >
        <ChevronLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Customers
      </Button>

      {/* Header Profile Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-6">
          <Avatar className="bg-solar shadow-solar h-20 w-20 border-4 border-white/5 lg:h-24 lg:w-24">
            <AvatarFallback className="bg-transparent text-2xl font-bold text-white lg:text-3xl">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-white lg:text-4xl">
              {customer.name}
            </h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5 text-sm">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </div>
              {customer.email && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Mail className="h-3.5 w-3.5" />
                  {customer.email}
                </div>
              )}
              {customer.city && (
                <div className="flex items-center gap-1.5 text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  {customer.city}
                </div>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={() => { setEditDialogOpen(true); }}
          variant="outline"
          className="gap-2 border-white/10 bg-white/5 hover:bg-white/10"
        >
          <Edit className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start border-b border-white/5 bg-transparent p-0">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:border-solar data-[state=active]:text-solar rounded-none border-b-2 border-transparent px-6 pt-2 pb-3 data-[state=active]:bg-transparent"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="quotations"
            className="data-[state=active]:border-solar data-[state=active]:text-solar rounded-none border-b-2 border-transparent px-6 pt-2 pb-3 data-[state=active]:bg-transparent"
          >
            Quotations
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="data-[state=active]:border-solar data-[state=active]:text-solar rounded-none border-b-2 border-transparent px-6 pt-2 pb-3 data-[state=active]:bg-transparent"
          >
            Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 md:grid-cols-3"
          >
            <Card className="border-white/5 bg-white/5 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  General Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Address
                    </span>
                    <p className="text-sm leading-relaxed">
                      {customer.address || 'No address provided'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      City
                    </span>
                    <p className="text-sm">
                      {customer.city || 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Notes
                  </span>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {customer.notes || 'No notes added for this customer.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-white/5 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    Customer Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Customer Since
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="text-solar h-3.5 w-3.5" />
                      {format(new Date(customer.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Quotes</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total Projects
                    </span>
                    <span className="font-medium">0</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Button
                    variant="outline"
                    className="hover:bg-solar/10 hover:text-solar hover:border-solar/20 justify-start gap-2 border-white/5 bg-white/5"
                  >
                    <FileText className="h-4 w-4" />
                    New Quotation
                  </Button>
                  <Button
                    variant="outline"
                    className="hover:bg-solar/10 hover:text-solar hover:border-solar/20 justify-start gap-2 border-white/5 bg-white/5"
                  >
                    <Layout className="h-4 w-4" />
                    Create Project
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="quotations">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/5 bg-white/5 py-24 text-center"
          >
            <div className="text-muted-foreground flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
              <FileText className="h-10 w-10 opacity-20" />
            </div>
            <h3 className="text-foreground mt-6 text-xl font-semibold">
              No quotations yet
            </h3>
            <p className="text-muted-foreground mt-2 max-w-xs">
              Create a solar quotation for this customer to get started.
            </p>
            <Button className="bg-solar mt-6 text-white">
              Create Quotation
            </Button>
          </motion.div>
        </TabsContent>

        <TabsContent value="projects">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/5 bg-white/5 py-24 text-center"
          >
            <div className="text-muted-foreground flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
              <Layout className="h-10 w-10 opacity-20" />
            </div>
            <h3 className="text-foreground mt-6 text-xl font-semibold">
              No active projects
            </h3>
            <p className="text-muted-foreground mt-2 max-w-xs">
              Once a quotation is accepted, it can be converted into a project.
            </p>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <CustomerDialog
        customer={customer}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
