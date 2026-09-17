-- Phase 5: which status may follow which.
--
-- The admin screen only offers valid buttons, but "the UI only offers valid
-- buttons" is not an invariant — it is a hope about the client. An order that
-- jumps from placed straight to delivered, or comes back from cancelled, is a
-- fulfilment record that no longer describes what happened.

create or replace function public.is_valid_order_transition(old_status text, new_status text)
returns boolean
language sql
immutable
as $$
  select case old_status
    when 'draft'         then new_status in ('placed', 'cancelled')
    when 'placed'        then new_status in ('in_production', 'rejected', 'cancelled')
    when 'in_production' then new_status in ('shipped', 'cancelled')
    when 'shipped'       then new_status in ('delivered', 'returned')
    when 'delivered'     then new_status in ('returned')
    -- rejected, cancelled and returned are terminal.
    else false
  end;
$$;

create or replace function public.enforce_order_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_items int;
begin
  new.shipping_total := public.delivery_charge(new.items_total);
  new.grand_total := coalesce(new.items_total, 0) + new.shipping_total;

  if new.status is distinct from old.status then
    if not public.is_valid_order_transition(old.status, new.status) then
      raise exception 'Cannot move an order from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    -- Only staff move an order on once the seller has placed it.
    if old.status <> 'draft' and not public.is_admin() then
      raise exception 'Only staff can change the status of a placed order'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.status = 'placed' and coalesce(old.status, '') = 'draft' then
    select count(*) into n_items from public.order_items where order_id = new.id;
    if n_items = 0 then
      raise exception 'Cannot place an empty order' using errcode = 'check_violation';
    end if;

    if coalesce(trim(new.contact_name), '') = ''
       or coalesce(trim(new.contact_phone), '') = ''
       or coalesce(trim(new.address_line1), '') = ''
       or coalesce(trim(new.city), '') = ''
       or coalesce(trim(new.state), '') = ''
       or coalesce(trim(new.pincode), '') = '' then
      raise exception 'Delivery details are incomplete' using errcode = 'check_violation';
    end if;

    if new.reference is null then
      new.reference := 'PD' || to_char(nextval('public.order_reference_seq'), 'FM000000');
    end if;
    new.placed_at := coalesce(new.placed_at, now());
  end if;

  return new;
end;
$$;
