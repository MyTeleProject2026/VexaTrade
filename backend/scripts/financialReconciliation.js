require('dotenv').config({path:require('path').join(__dirname,'..','.env')});
const pool=require('../db');
const {reconcileFinancialState}=require('../services/financialReconciliationService');
(async()=>{try{const result=await reconcileFinancialState(pool);console.log(JSON.stringify(result,null,2));process.exitCode=result.healthy?0:2;}catch(error){console.error('Financial reconciliation failed:',error.message);process.exitCode=1;}finally{await pool.end();}})();
