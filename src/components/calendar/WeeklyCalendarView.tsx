
"use client";

import React from 'react';
import { format, parse, addMinutes, differenceInMinutes, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, getHours, getMinutes, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const TIME_SLOT_HEIGHT_PX_VALUE = 60; // Corresponds to --time-slot-height in globals.css
const CALENDAR_START_HOUR = 6; // 6 AM
const CALENDAR_END_HOUR = 21; // 9 PM (slots up to 20:30)

interface Booking {
  id: string;
  AppointmentID: string;
  ClientID: string;
  ClientName?: string;
  ServiceProcedure: string;
  AppointmentDate: string; // yyyy-MM-dd
  AppointmentStartTime: string; // HH:mm
  AppointmentEndTime: string; // HH:mm
  BookingStatus?: string;
}

interface WeeklyCalendarViewProps {
  bookings: Booking[];
  currentDate: Date; // Any date within the week to display
  onDayClick?: (date: Date) => void;
  onBookingClick?: (booking: Booking) => void; 
}

const timeToPosition = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  const minutesFromCalendarStart = (hours - CALENDAR_START_HOUR) * 60 + minutes;
  return (minutesFromCalendarStart / 60) * TIME_SLOT_HEIGHT_PX_VALUE;
};

const durationToHeight = (startTime: string, endTime: string): number => {
  const startDate = parse(startTime, 'HH:mm', new Date());
  const endDate = parse(endTime, 'HH:mm', new Date());
  const diffMins = differenceInMinutes(endDate, startDate);
  return (diffMins / 60) * TIME_SLOT_HEIGHT_PX_VALUE;
};


const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({ bookings, currentDate, onDayClick, onBookingClick }) => {
  const weekStartsOn = 1; // Monday
  const weekStart = startOfWeek(currentDate, { weekStartsOn });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn });
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const timeSlots = [];
  for (let i = CALENDAR_START_HOUR; i <= CALENDAR_END_HOUR; i++) {
    timeSlots.push(format(new Date(0, 0, 0, i, 0), 'h a')); // e.g., 6 AM, 7 AM
  }

  return (
    <div className="flex flex-col border border-border rounded-lg shadow-sm overflow-hidden">
      {/* Header: Day Names and Dates */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-muted/50">
        <div className="p-2 border-r border-b border-border text-center font-medium text-muted-foreground text-sm sticky top-0 z-10 bg-muted/50">Time</div>
        {daysOfWeek.map(day => (
          <div
            key={day.toISOString()}
            className={cn(
              "p-2 border-r border-b border-border text-center font-medium text-sm sticky top-0 z-10 bg-muted/50",
              isSameDay(day, new Date()) && "bg-primary/10 text-primary dark:bg-primary/20"
            )}
            onClick={() => onDayClick?.(day)}
          >
            <div>{format(day, 'EEE')}</div>
            <div className="text-xs text-muted-foreground">{format(day, 'd')}</div>
          </div>
        ))}
      </div>

      {/* Body: Time Slots and Bookings */}
      <div className="flex-grow overflow-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          {/* Time Axis Labels */}
          <div className="col-start-1 col-end-2 row-start-1 row-end-auto">
            {timeSlots.map((slot, index) => (
              <div
                key={slot}
                className="h-[var(--time-slot-height)] border-r border-border flex items-center justify-center text-xs text-muted-foreground p-1 text-right"
                style={{ top: `${index * TIME_SLOT_HEIGHT_PX_VALUE}px` }}
              >
                {slot}
              </div>
            ))}
          </div>

          {/* Grid Lines & Booking Placement Area for each day */}
          {daysOfWeek.map((day, dayIndex) => (
            <div
              key={day.toISOString()}
              className={cn(
                "col-start-" + (dayIndex + 2) + " col-end-" + (dayIndex + 3) + " row-start-1 row-end-auto relative border-r border-border",
                isSameDay(day, new Date()) && "bg-primary/5 dark:bg-primary/10"
              )}
              onClick={() => onDayClick?.(day)}
            >
              {/* Horizontal Grid Lines */}
              {timeSlots.map((_, slotIndex) => (
                <div
                  key={`hline-${dayIndex}-${slotIndex}`}
                  className="h-[var(--time-slot-height)] border-b border-border/50"
                ></div>
              ))}

              {/* Bookings for this day */}
              {bookings
                .filter(booking => isSameDay(parseISO(booking.AppointmentDate), day) && booking.BookingStatus === "Booked")
                .map(booking => {
                  const top = timeToPosition(booking.AppointmentStartTime);
                  const height = durationToHeight(booking.AppointmentStartTime, booking.AppointmentEndTime);

                  // Ensure booking is within displayable hours
                  const bookingStartHour = getHours(parse(booking.AppointmentStartTime, 'HH:mm', new Date()));
                  const bookingEndHour = getHours(parse(booking.AppointmentEndTime, 'HH:mm', new Date())) + (getMinutes(parse(booking.AppointmentEndTime, 'HH:mm', new Date())) > 0 ? 1 : 0);
                  
                  if (bookingEndHour < CALENDAR_START_HOUR || bookingStartHour > CALENDAR_END_HOUR) {
                    return null; // Booking is completely outside visible hours
                  }

                  return (
                    <div
                      key={booking.id}
                      className={cn(
                        "absolute left-[2px] right-[2px] bg-primary/80 text-primary-foreground p-1.5 rounded shadow-sm overflow-hidden cursor-pointer hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring",
                        "dark:bg-primary/70 dark:hover:bg-primary/90"
                      )}
                      style={{ top: `${top}px`, height: `${Math.max(height, 15)}px` }} // min height for visibility
                      title={`${booking.AppointmentStartTime}-${booking.AppointmentEndTime}: ${booking.ClientName} - ${booking.ServiceProcedure}`}
                      onClick={(e) => { 
                        e.stopPropagation(); // Prevent day click if booking is clicked
                        onBookingClick?.(booking);
                       }}
                      tabIndex={0} // Make it focusable
                    >
                      <p className="text-xs font-semibold truncate">{booking.ClientName || "N/A"}</p>
                      <p className="text-[10px] truncate">{booking.ServiceProcedure}</p>
                       <p className="text-[9px] opacity-80 truncate">{booking.AppointmentStartTime} - {booking.AppointmentEndTime}</p>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendarView;

