import { Request } from 'express';
import { Types } from 'mongoose';
import { IAdmin } from '../modules/common/models/Admin';
import { ISuperAdmin } from '../modules/common/models/SuperAdmin';
import { IRestaurant } from '../modules/common/models/Restaurant';
import { ICustomer } from '../modules/common/models/Customer';

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
