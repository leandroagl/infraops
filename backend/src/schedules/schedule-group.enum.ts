export enum ScheduleGroup {
  BIMONTHLY_ODD  = 'BIMONTHLY_ODD',   // Ene, Mar, May, Jul, Sep, Nov
  BIMONTHLY_EVEN = 'BIMONTHLY_EVEN',  // Feb, Abr, Jun, Ago, Oct, Dic
}

export const MONTH_TO_GROUP: Record<number, ScheduleGroup> = {
  1:  ScheduleGroup.BIMONTHLY_ODD,
  2:  ScheduleGroup.BIMONTHLY_EVEN,
  3:  ScheduleGroup.BIMONTHLY_ODD,
  4:  ScheduleGroup.BIMONTHLY_EVEN,
  5:  ScheduleGroup.BIMONTHLY_ODD,
  6:  ScheduleGroup.BIMONTHLY_EVEN,
  7:  ScheduleGroup.BIMONTHLY_ODD,
  8:  ScheduleGroup.BIMONTHLY_EVEN,
  9:  ScheduleGroup.BIMONTHLY_ODD,
  10: ScheduleGroup.BIMONTHLY_EVEN,
  11: ScheduleGroup.BIMONTHLY_ODD,
  12: ScheduleGroup.BIMONTHLY_EVEN,
};
