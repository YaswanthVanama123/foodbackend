import { Request } from 'express';
import { Types } from 'mongoose';
import { IAdmin } from '../models/Admin';
import { ISuperAdmin } from '../models/SuperAdmin';
import { IRestaurant } from '../models/Restaurant';
import { ICustomer } from '../models/Customer';

declare global {
  namespace Express {
    interface Request {
      // Restaurant admin (authenticated via JWT)
      admin?: IAdmin;

      // Super admin (platform owner)
      superAdmin?: ISuperAdmin;

      // Customer (authenticated via JWT)
      customer?: ICustomer;

      // Tenant context (extracted from subdomain)
      tenant?: IRestaurant;
      restaurantId?: Types.ObjectId;
    }
  }
}

export {};
