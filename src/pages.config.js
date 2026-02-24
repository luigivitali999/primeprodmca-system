/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import CreatorDetail from './pages/CreatorDetail';
import Creators from './pages/Creators';
import DMCARequests from './pages/DMCARequests';
import Dashboard from './pages/Dashboard';
import DirectOrders from './pages/DirectOrders';
import Domains from './pages/Domains';
import Leaks from './pages/Leaks';
import PendingApprovals from './pages/PendingApprovals';
import Pipeline from './pages/Pipeline';
import Reports from './pages/Reports';
import SocialProtection from './pages/SocialProtection';
import Whitelist from './pages/Whitelist';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CreatorDetail": CreatorDetail,
    "Creators": Creators,
    "DMCARequests": DMCARequests,
    "Dashboard": Dashboard,
    "DirectOrders": DirectOrders,
    "Domains": Domains,
    "Leaks": Leaks,
    "PendingApprovals": PendingApprovals,
    "Pipeline": Pipeline,
    "Reports": Reports,
    "SocialProtection": SocialProtection,
    "Whitelist": Whitelist,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};