import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { json } from '@angular-devkit/core';
import { Schema } from './schema';

const NetlifyAPI = require('netlify');

export default createBuilder<any>(
  async (builderConfig: Schema, context: BuilderContext): Promise<BuilderOutput> => {
    context.reportStatus(`Executing deploy...`);
    context.logger.info(`Executing netlify deploy command ...... `);
    let buildResult;
    if (builderConfig.noBuild) {
      context.logger.info(`📦 Skipping build`);
      buildResult = true;
    } else {
      const configuration = builderConfig.configuration ? builderConfig.configuration : 'production';

      const overrides = {
        // this is an example how to override the workspace set of options
        ...(builderConfig.baseHref && { baseHref: builderConfig.baseHref })
      };

      if (!context.target) {
        throw new Error('Cannot deploy the application without a target');
      }

      context.logger.info(`📦 Building "${context.target.project}". Configuration: "${configuration}".${builderConfig.baseHref ? ' Your base-href: "' + builderConfig.baseHref + '"' : ''}`);

      const build = await context.scheduleTarget({
        target: 'build',
        project: context.target !== undefined ? context.target.project : '',
        configuration
      }, overrides as json.JsonObject);

      buildResult = await build.result;
    }

    if (buildResult.success || buildResult) {
      context.logger.info(`✔ Build Completed`);
      const netlifyToken = process.env.NETLIFY_TOKEN || builderConfig.netlifyToken;
      if (netlifyToken == '' || netlifyToken == undefined) {
        context.logger.error("🚨 Netlify Token not found !");
        return { success: false };
      }
      const client = new NetlifyAPI(netlifyToken,
        {
          userAgent: 'netlify/js-client',
          scheme: 'https',
          host: 'api.netlify.com',
          pathPrefix: '/api/v1',
          globalParams: {}
        });
      let sites;
      try {
        sites = await client.listSites();
      } catch (e) {
        context.logger.error("🚨 Netlify Token Rejected");
        return { success: false };
      }
      context.logger.info(`✔ User Verified`);
      const siteId = process.env.NETLIFY_API_ID || builderConfig.siteId;
      if (siteId == '' || siteId == undefined) {
        context.logger.error("🚨 API ID (Site ID) not found !");
        return { success: false };
      }
      const isSiteValid = sites.find(site => siteId === site.site_id);
      if (isSiteValid) {
        context.logger.info(`✔ Site ID Confirmed`);

        const response = await client.deploy(siteId, builderConfig.outputPath);
        context.logger.info(`Deploying project from the location 📂  ./"${builderConfig.outputPath}`);
        context.logger.info(`\n ✔ Your updated site 🕸 is running at ${response && response.deploy && response.deploy.ssl_url}`);

        return { success: true };
      }
      else {
        context.logger.error(`❌ Site ID not found`);
        return { success: false };
      }
    } else {
      context.logger.error(`❌ Application build failed`);
      return {
        error: `❌ Application build failed`,
        success: false
      };
    }

  });