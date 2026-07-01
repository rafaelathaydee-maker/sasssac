import { Request, Response } from "express";

type Provider = {
  handleWebhook(req: Request, res: Response): Promise<unknown> | unknown;
};

const noopProvider: Provider = {
  handleWebhook(_req, res) {
    return res.status(200).send("ok");
  },
};

export function getProvider(_channel: string): Provider {
  return noopProvider;
}

